<div align="center">
	<h1>Guide Grok</h1>
	<p><strong>Interactive assignment & study guide workspace with AI-assisted PDF parsing, problem splitting, reminders, and email automation.</strong></p>
	<p>
		<a href="#quickstart">Quickstart</a> •
		<a href="#features">Features</a> •
		<a href="#architecture">Architecture</a> •
		<a href="#environment-variables">Environment</a> •
		<a href="#scripts">Scripts</a> •
		<a href="#development">Development</a> •
		<a href="#ai-modules">AI</a> •
		<a href="#reminders--automation">Reminders</a>
	</p>
</div>

---

## Overview
Guide Grok ingests assignment/problem PDFs, extracts problems, optionally uses AI (Gemini/OpenAI) to segment and enrich them, and provides a focused workspace for tracking progress. A reminders subsystem (local & Firebase backed) can schedule nudges and email summaries via the AgentMail SDK. Audio (ElevenLabs) & time estimation utilities round out the study experience.

## Tech Stack
| Layer | Tech |
|-------|------|
| Build / Dev | Vite, TypeScript, SWC |
| UI | React 18, shadcn-ui (Radix primitives), Tailwind CSS |
| State / Data | Zustand, React Query |
| Auth & Realtime | Firebase (Auth, Firestore, Storage, Messaging) |
| AI | Google Gemini, OpenAI (optional), heuristic fallback parsers |
| PDF | pdfjs, react-pdf, custom extraction worker |
| Email / Notifications | AgentMail SDK, custom reminder jobs |
| Forms / Validation | react-hook-form + zod |

## Features
* PDF upload, extraction & inline viewing
* AI-backed problem splitting & guidance (Gemini / OpenAI)
* Local fallback parser when AI disabled
* Assignment dashboard & progress tracking
* Time estimation utilities
* Reminder & scheduling jobs (local scripts + Firebase runtime)
* Email draft generation & sending (AgentMail)
* Optional TTS voice integration (ElevenLabs)
* Modern accessible component library (shadcn-ui / Radix)

## Quickstart
1. Install Node (use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)). Recommended: Node 20+.
2. Clone & install deps:
	 ```bash
	 git clone <your-fork-or-repo-url>
	 cd guide-grok
	 npm install
	 ```
3. Create a `.env.local` from `.env.example` & fill in required keys (Firebase required for auth/storage; AI keys optional).
4. Start dev server:
	 ```bash
	 npm run dev
	 ```
5. Open http://localhost:5173 (default Vite port) and sign in with Google (requires Firebase config).

## Environment Variables
Environment variables are consumed via Vite (`import.meta.env`). Never commit secrets. Use `.env.local` (git‑ignored). See `.env.example` for the full list.

Required (Firebase):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Optional Enhancements:
```
VITE_GEMINI_API_KEY                # Enables Gemini problem splitting & guidance
VITE_GEMINI_MODEL=gemini-2.5-flash  # Override model
VITE_GEMINI_GUIDANCE_MODEL=gemini-pro
VITE_OPENAI_API_KEY                 # Enables OpenAI-based guidance (if integrated)
VITE_ELEVENLABS_API_KEY            # Enables TTS voice
VITE_ELEVENLABS_VOICE_ID           # Selected voice ID
```

Runtime / Script Overrides (not usually needed in frontend env file; can be exported inline when running scripts):
```
TEST_MINUTES_MODE=true
TEST_WINDOWS=1,2
TEST_WINDOW_MINUTES=1
TEST_DRY_RUN=true
```

### Security Notes
* Remove any accidental committed secrets immediately & rotate them.
* Do not add `.env.local` to build pipelines or source control.
* Keys prefixed with `VITE_` are embedded in the client bundle—only use for public-safe keys (AI keys may need usage quotas/monitoring).

## Scripts
From `package.json`:
| Script | Purpose |
|--------|---------|
| dev | Launch Vite dev server |
| build | Production build |
| build:dev | Build using development mode (faster, unminified) |
| preview | Preview production build locally |
| lint | Run ESLint |
| test | Run Vitest test suite |
| agentmail:test | Send a test email via AgentMail |
| reminders:prepare | Create sample assignments for reminders |
| reminders:live | Run live reminder sending loop (env overrides inside) |
| reminders:firebase | Run Firebase-integrated reminder process |
| drafts:send | Generate & send email drafts immediately |
| drafts:schedule | Schedule drafts for later sending |
| seed:firebase | Seed Firebase with assignment data |
| manual-send:server | Run manual send server script |

Use `npm run <script>`.

## Development
### Code Style & Linting
* ESLint + TypeScript ESLint configured in `eslint.config.js`.
* Run `npm run lint` before committing major changes.

### Testing
* Framework: Vitest.
* Add tests under `src/**/__tests__` or alongside modules with `*.test.ts(x)`.
* Run: `npm test`.

### Components & UI
Reusable UI components live in `src/components/ui/` (shadcn pattern). Higher-level feature components (PDF viewer, problem workspace, dashboards) live in `src/components/`.

### State Management
* Global lightweight state: Zustand (`src/lib/store.ts`).
* Server/cache state: React Query for async operations.

### PDF Processing
* `src/lib/pdfExtractor.ts` handles raw extraction.
* `src/lib/pdfWorker.ts` offloads heavy parsing to a worker (improves UI responsiveness).

## AI Modules
* `aiProblemSplitter.ts` – Splits raw extracted text into structured problem objects. Uses Gemini when configured, falls back to heuristics.
* `aiGuidance.ts` – Provides hints / explanations using model APIs.
* `problemParser.ts` – Deterministic fallback & cleanup layer.

Graceful Degradation: If no AI keys are found or a request fails, the system logs a warning and uses local parsing so the workflow remains usable.

## Reminders & Automation
Scripts in `scripts/` power recurring reminders and email workflows:
| Script | Summary |
|--------|---------|
| reminders_firebase.mjs | Firebase-backed reminder dispatch |
| run_reminders_with_firebase.mjs | Entry for combined reminder processing |
| send_reminders_live.mjs | Live run loop for sending reminders |
| drafts_create_and_send.mjs | Generate and immediately send drafts |
| drafts_schedule.mjs | Schedule drafts in the future |
| seed_firebase_assignments.mjs | Populate sample assignment data |
| prepare_sample_assignments.mjs | Local sample dataset preparation |

Set runtime env patches inline, e.g.:
```bash
TEST_DRY_RUN=false TEST_WINDOWS=1,2 npm run reminders:live
```

## Architecture
```
src/
	auth/                # AuthProvider & related logic
	components/          # Feature + UI components
	hooks/               # Custom reusable hooks
	jobs/                # Reminder job orchestrators (TS variants)
	lib/                 # Core logic (AI, PDF, firebase, store, utils)
	pages/               # Route-level components (Router driven)
	types/               # Type declarations & ambient defs
```

Data Flow:
1. User uploads PDF -> extractor/worker parses -> problem parser normalizes.
2. Optional AI enrichment (splitting, guidance) merges into problem set.
3. Zustand store & React Query manage state & async caching.
4. User progress & assignments sync to Firebase (if enabled).
5. Reminders scripts read assignments & dispatch emails via AgentMail.

## Deployment
You can deploy a production build anywhere that serves static assets:
1. Build: `npm run build`
2. Deploy `dist/` to Vercel, Netlify, Firebase Hosting, Cloudflare Pages, etc.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Blank PDF viewer | Ensure `pdfjs-dist` version matches import & no CSP blocking worker |
| AI calls failing | Check rate limits & that `VITE_GEMINI_API_KEY` / `VITE_OPENAI_API_KEY` are present |
| Firebase auth popup blocked | Allow popups or use redirect flow |
| Reminder scripts exit early | Remove TEST_* overrides or set `TEST_DRY_RUN=false` |
| Bundled secrets leaked | Rotate keys & purge old deploys |

## Contributing
1. Fork & branch (`feat/<feature-name>`)
2. Keep PRs focused & small
3. Include/update tests for logic changes
4. Describe any new environment variables

## Roadmap (Ideas)
* Rich analytics on study velocity
* Multi-user assignment collaboration
* Model selection UI toggle
* Offline-first caching of extracted problems
* Extended email templating & digest summaries
