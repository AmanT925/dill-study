---
title: Drafts
subtitle: Preparing and scheduling Messages for your agents.
slug: drafts
description: >-
  Learn how to create, manage, and send Drafts to enable advanced agent
  workflows like human-in-the-loop review and scheduled sending.
---

## What is a Draft?

A `Draft` is an unsent `Message`. It's a resource that allows your agent to prepare the contents of an email—including recipients, a subject, a body, and `Attachments`—without sending it immediately.

We know agent reliability is big these days--with `Drafts` you can have agents have ready-to-send emails and only with your permission it can send them off into the world.

`Drafts` are a key component for building advanced agent workflows. They enable:

- **Human-in-the-Loop Review:** An agent can create a `Draft` for a sensitive or important `Message`, which a human can then review and approve before it's sent.
- **Scheduled Sending:** Your agent can create a `Draft` and then have a separate process send it at a specific time, such as during business hours for the recipient.
- **Complex Composition:** For `Messages` that require multiple steps to build (e.g., fetching data from several sources, generating content), `Drafts` allow you to save the state of the email as it's being composed.

## The `Draft` Lifecycle

You can interact with `Drafts` throughout their lifecycle, from creation to the moment they are sent.

### 1. Create a `Draft`

This is the first step. You create a `Draft` in a specific `Inbox` that will eventually be the sender.

Python

```python
# You'll need an inbox ID to create a draft in.

new_draft = client.inboxes.drafts.create(
  inbox_id="outbound@domain.com",
  to=["review-team@example.com"],
  subject="[NEEDS REVIEW] Agent's proposed response"
)

print(f"Draft created successfully with ID: {new_draft.draft_id}")
```

TypeScript

```typescript
// You'll need an inbox ID to create a draft in.

const newDraft = await client.inboxes.drafts.create(
  "my_inbox@domain.com",
  {
    to: ["review-team@example.com"],
    subject: "[NEEDS REVIEW] Agent's proposed response"
  }
);

console.log(`Draft created successfully with ID: ${newDraft.id}`);
```

### 2. Get `Draft`

Once a `Draft` is created, you can retrieve it by its ID.

Python

```python
# Get the draft

draft = client.inboxes.drafts.get(inbox_id='my_inbox@domain.com', draft_id='draft_id_123')
```

TypeScript

```typescript
// Get the draft
const draft = await client.inboxes.drafts.get(
  "inbox_id",
  "draft_id_123"
);
```

### 3. Send a `Draft`

This is the final step that converts the `Draft` into a sent `Message`. Once sent, the `Draft` is deleted.

Python

```python
# This sends the draft and deletes it

sent_message = client.inboxes.drafts.send(inbox_id='my_inbox@domain.com', draft_id='draft_id_123')

print(f"Draft sent! New message ID: {sent_message.message_id}")
```

TypeScript

```typescript
const sentMessage = await client.inboxes.drafts.send('my_inbox@domain.com', 'draft_id_123');

console.log(`Draft sent! New message ID: ${sentMessage.message_id}`);
```

Note that now we access it by message_id now because now its a message!!

## Org-Wide `Draft` Management

Similar to `Threads`, you can list all `Drafts` across your entire `Organization`. This is perfect for building a central dashboard where a human supervisor can view, approve, or delete any `Draft` created by any agent in your fleet.

Python

```python
# Get all drafts across the entire organization
all_drafts = client.drafts.list()

print(f"Found {all_drafts.count} drafts pending review.")
```

TypeScript

```typescript
// Get all drafts across the entire organization
const allDrafts = await client.drafts.list();

console.log(`Found ${allDrafts.count} drafts pending review.`);
```

## Scheduled sending

There are two common patterns to schedule sending a `Draft`:

1. Create the `Draft` and schedule a background job (cron/worker) to call the `drafts.send` endpoint at the desired time.
2. Store a `sendAt` timestamp with the `Draft` in your own DB and run a worker that checks for `sendAt <= now` and calls `drafts.send`.

Below are examples of both approaches in TypeScript and Python.

### Option A — Simple scheduler (cron / worker)

Flow:
- Agent creates a `Draft` and the draft ID is returned.
- You schedule a job (cron or background worker) that will call `client.inboxes.drafts.send` for that draft at the scheduled time.

TypeScript example (node worker using `node-cron` or a simple setTimeout for demo):

```typescript
import "dotenv/config";
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

async function sendDraftAt(inboxId: string, draftId: string, sendAt: Date) {
  const ms = sendAt.getTime() - Date.now();
  if (ms <= 0) {
    // send immediately
    await client.inboxes.drafts.send(inboxId, draftId);
    return;
  }
  // in production use a durable job scheduler, not setTimeout
  setTimeout(async () => {
    await client.inboxes.drafts.send(inboxId, draftId);
    console.log(`Draft ${draftId} sent from ${inboxId}`);
  }, ms);
}

// Example: send 5 minutes from now
// sendDraftAt('outbound@domain.com', 'draft123', new Date(Date.now()+5*60*1000));
```

Python example (simple scheduler using APScheduler for production):

```python
from agentmail import AgentMail
from apscheduler.schedulers.background import BackgroundScheduler
import os

client = AgentMail(api_key=os.getenv('AGENTMAIL_API_KEY'))

scheduler = BackgroundScheduler()

def send_draft(inbox_id, draft_id):
    client.inboxes.drafts.send(inbox_id=inbox_id, draft_id=draft_id)

# Schedule job
send_at = datetime.utcnow() + timedelta(minutes=5)
scheduler.add_job(send_draft, 'date', run_date=send_at, args=['outbound@domain.com', 'draft123'])
scheduler.start()
```

### Option B — Store `sendAt` in your DB and run a worker

Flow:
- Create draft and store a record in your DB with `inbox_id`, `draft_id`, and `send_at` timestamp.
- Run a worker every minute (or more often) to query for drafts with `send_at <= now` and not-yet-sent, then call `drafts.send` and mark them sent in your DB.

TypeScript worker example (pseudo-code):

```typescript
// pseudo-code — replace with your DB client
import { AgentMailClient } from "agentmail";
import { queryDueDrafts, markDraftSent } from './db';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

async function runSendDueDrafts() {
  const due = await queryDueDrafts(new Date());
  for (const d of due) {
    try {
      await client.inboxes.drafts.send(d.inbox_id, d.draft_id);
      await markDraftSent(d.id);
    } catch (e) {
      console.error('Failed sending draft', d.id, e);
    }
  }
}

// schedule every minute in production via cron or worker
setInterval(runSendDueDrafts, 60_000);
```

Python worker example (pseudo-code):

```python
# query DB for due drafts
for draft in query_due_drafts(now):
    try:
        client.inboxes.drafts.send(inbox_id=draft.inbox_id, draft_id=draft.draft_id)
        mark_draft_sent(draft.id)
    except Exception as e:
        logging.exception('Failed sending draft %s', draft.id)
```

### Safety and best practices

- Use a durable scheduler (Cloud Tasks, AWS SQS + Lambda, Sidekiq, Celery, or a hosted cron) for production scheduled sending.
- Respect user opt-outs and unsubscribe lists. Always check recipient preferences before sending scheduled messages.
- Add retries with exponential backoff for transient failures, and add alerting for persistent failures.
- Consider rate limiting and batching to avoid hitting provider limits.
- Maintain audit logs: who scheduled the draft, when, and when it was sent.

### Example: combining Drafts with human review

- Agent creates a draft and sets `sendAt` for 24 hours later.
- Human supervisor sees the draft in the review dashboard and can either approve (which sets `approved=true`) or reject.
- The scheduled worker checks `sendAt <= now AND approved = true` before calling `drafts.send`.

```sql
-- example DB row
INSERT INTO scheduled_drafts (draft_id, inbox_id, send_at, approved, created_by) VALUES (...);
```

That's it — with `Drafts` plus a scheduler you can support human review, scheduled sending, and safer agent-driven outbound email flows.
