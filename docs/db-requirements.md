# Database requirements for the assignment-reminder system

Hi [Friend's Name],

Thanks for helping with the database for our assignment-reminder system — really appreciate it. Below is a concise spec for the schema and the queries the reminder worker will need. Please let me know if anything is unclear or if you'd prefer a different naming convention — I can adapt our code to match.

## Summary of what we need

- Track users (students), their contact info and opt-outs.
- Track assignments with due dates, completion status, which student they belong to, and optional metadata.
- Track scheduled reminders and their send status (so we don't duplicate sends).
- Lightweight audit log for sends and failures (message_id, status, error).
- Support time zone-aware due dates and a method to query assignments due within N minutes/hours for the reminder worker.

---

## Minimal schema (Postgres-style DDL)

### users (students)
- id: uuid PRIMARY KEY
- email: text NOT NULL UNIQUE
- name: text
- timezone: text NULL — IANA tz name (e.g., `America/Los_Angeles`); default UTC if null
- contact_opt_out: boolean NOT NULL DEFAULT false
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

### assignments
- id: uuid PRIMARY KEY
- title: text NOT NULL
- description: text NULL
- student_id: uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- due_at: timestamptz NOT NULL — store in UTC; use client timezone for display
- completed: boolean NOT NULL DEFAULT false
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()
- metadata: jsonb NULL — optional for problem IDs, course, etc.
- INDEX: (student_id, due_at)

### reminders
- id: uuid PRIMARY KEY
- assignment_id: uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE
- reminder_type: text NOT NULL — e.g., `24h`, `2h`, `daily-summary`
- scheduled_for: timestamptz NOT NULL — when we plan to send (UTC)
- sent_at: timestamptz NULL
- status: text NOT NULL DEFAULT 'pending' — 'pending', 'sent', 'failed', 'skipped'
- attempts: int NOT NULL DEFAULT 0
- last_error: text NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()
- UNIQUE(assignment_id, reminder_type) — ensures we don't schedule duplicates for same assignment/reminder

### send_logs (audit)
- id: uuid PRIMARY KEY
- reminder_id: uuid NULL REFERENCES reminders(id)
- assignment_id: uuid NULL REFERENCES assignments(id)
- to_email: text NOT NULL
- from_inbox: text NOT NULL
- message_id: text NULL — provider message id
- status: text NOT NULL — 'queued', 'delivered', 'bounced', 'rejected', 'failed'
- error: text NULL
- created_at: timestamptz NOT NULL DEFAULT now()

---

## Optional / additional tables

- organizations / teachers (if you want to scope data to an org)
- user_preferences (preferred delivery hour, daily summary opt-in/out)
- rate_limit / quotas

---

## Important constraints and indexes

- `users.email` unique index
- `assignments`: index on `(student_id, due_at)` and maybe `(due_at)` for global queries
- `reminders`: unique constraint to avoid double-scheduling; index on `(scheduled_for, status)` to pick due reminders fast
- `send_logs`: index on `(reminder_id, created_at)`

---

## Sample queries the reminder worker needs

- Find assignments due within a minute/hour window (minutes mode for testing; hours mode for production):

  - For minutes (N minutes):

    SELECT *
    FROM assignments
    WHERE completed = false
      AND due_at BETWEEN now() + INTERVAL 'N minutes' - INTERVAL 'T minutes'
                    AND now() + INTERVAL 'N minutes' + INTERVAL 'T minutes'
      AND student_id IN (SELECT id FROM users WHERE contact_opt_out = false);

  - For hours (H hours): same pattern with `'H hours'` and a window tolerance (T minutes).

- Insert reminder record (if not exists):

  INSERT INTO reminders (id, assignment_id, reminder_type, scheduled_for)
  VALUES (...) ON CONFLICT (assignment_id, reminder_type) DO NOTHING;

- Mark reminder sent:

  UPDATE reminders SET status='sent', sent_at=now(), attempts=attempts+1 WHERE id = $1;

- Log send attempt:

  INSERT INTO send_logs (reminder_id, assignment_id, to_email, from_inbox, message_id, status, error) VALUES (...);

---

## Daily summary query (per student)

- Per-student counts and upcoming items:

  SELECT
    count(*) FILTER (WHERE completed = false AND due_at >= now()) AS current,
    count(*) FILTER (WHERE completed = false AND due_at < now()) AS overdue,
    count(*) FILTER (WHERE completed = true) AS completed
  FROM assignments
  WHERE student_id = $1;

---

## Edge cases and operational notes

- Timezones: store timestamps in UTC (`timestamptz`) and store user timezone for friendly display; when scheduling daily summaries, convert user's preferred local send hour to UTC for the `scheduled_for` value.
- Idempotency: use UNIQUE on `(assignment_id, reminder_type)` and mark reminders as sent so the worker can be retried safely.
- Opt-outs: always check `users.contact_opt_out` before sending.
- Backoff & retries: on transient failures (network), increment `attempts` and retry with exponential backoff. After N attempts (e.g., 5) mark as `failed` and notify a human or log.
- Bounces/blacklist: keep track of `send_logs.status`; if an address bounces or is rejected repeatedly, set `contact_opt_out=true` or flag the user.
- Testing: add a test-only mode where the query uses minutes (1m/2m) instead of hours and the worker runs immediately; this is how we validate end-to-end.
- Scaling: query assignments in pages; worker should process batches to avoid memory issues and to rate-limit sends.

---

## Example minimal migration SQL (Postgres)

```sql
-- users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  timezone text,
  contact_opt_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- assignments
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assignments_student_due_idx ON assignments (student_id, due_at);

-- reminders
CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, reminder_type)
);
CREATE INDEX reminders_scheduled_idx ON reminders (scheduled_for, status);

-- send_logs
CREATE TABLE send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NULL REFERENCES reminders(id),
  assignment_id uuid NULL REFERENCES assignments(id),
  to_email text NOT NULL,
  from_inbox text NOT NULL,
  message_id text NULL,
  status text NOT NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Sample rows (JSON)

users:

```json
{ "id": "u1", "email": "student1@example.com", "name": "Alice", "timezone": "America/Los_Angeles" }
```

assignments:

```json
{ "id": "a1", "title": "Problem set 1", "student_id": "u1", "due_at": "2025-09-27T23:00:00Z", "completed": false }
```

reminders:

```json
{ "id": "r1", "assignment_id": "a1", "reminder_type": "24h", "scheduled_for": "2025-09-26T23:00:00Z", "status": "sent", "sent_at": "2025-09-26T23:00:02Z" }
```

---

## Operational notes for the worker (high-level)

- Please expose a simple API or SQL view the worker can query:
  - `GET /due-assignments?unit=minutes&targets=1,2&tolerance=1` (or equivalent SQL view)
- The worker will:
  1. Query assignments due within each target window for all students (respecting opt-outs).
  2. For each matching assignment, attempt to INSERT a `reminders` row (`ON CONFLICT DO NOTHING`). If insert succeeds (meaning we haven't already scheduled/sent that reminder), call the mail API and record result in `send_logs` and update `reminders.status`.
- If possible, add an index on `due_at` and on `student_id` for fast filtering.

If you want, I can provide a SQL file or a small migration script (knex/TypeORM/Prisma) matching your preferred stack. Also happy to hop on a quick call or pair-program the integration.

Thanks again — really appreciate you taking this on.
