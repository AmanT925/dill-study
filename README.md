# Dill.study

Interactive assignment & study guide workspace for parsing PDFs into problems, tracking progress, and getting AI-guided assistance.

This README reflects the current project files and scripts found in the repository (Vite + React + TypeScript, shadcn-ui primitives, Tailwind, Zustand store).

## Quickstart

Prerequisites
- Node.js (recommended: Node 20+)
- npm (or your preferred Node package manager)

Install and run locally

```bash
git clone <your-fork-or-repo-url>
cd dill-study
npm install
# create .env.local from .env.example if present and fill required keys
npm run dev
```

Open http://localhost:8080 (this project config uses port 8080 by default in `vite.config.ts`).

## What this project does
- Upload PDFs, extract text and pages (see `src/lib/pdfExtractor.ts`)
- Split/extract problems using a local heuristic parser (`src/lib/problemParser.ts`) or an optional AI splitter (`src/lib/aiProblemSplitter.ts`) when configured
- Local persistence of uploaded files via `src/lib/localPDFStore.ts`
- Per-problem workspace with a full PDF viewer, editable OCR text, AI assistant chat, and hint flow (`src/components/ProblemWorkspace.tsx`, `src/components/PDFViewer.tsx`, `src/components/ProblemParsingPreview.tsx`)
- Simple reminders and email helper scripts in `scripts/` (AgentMail integration)

## Project layout (important files)
- `package.json` — scripts & dependencies
- `vite.config.ts` — Vite dev server (host/port) and aliases
- `src/` — source code
  - `src/components/` — UI components and feature screens (PDFUploader, PDFViewer, ProblemWorkspace, ProblemParsingPreview, Header)
  - `src/pages/` — route-level pages (Index, Dashboard, Library-ish views)
  - `src/lib/` — business logic: `pdfExtractor.ts`, `problemParser.ts`, `aiProblemSplitter.ts`, `aiGuidance.ts`, `localPDFStore.ts`, `store.ts` (Zustand)
  - `src/jobs/` & `scripts/` — reminder and email helper scripts (NodeJS utilities used outside of the client app)
  - `src/components/ui/` — shadcn-style UI primitives (Card, Button, Badge, Separator, etc.)

## Scripts
Available via `npm run <script>` (from `package.json`):

- `dev` — start Vite dev server (port 8080 by default)
- `build` — production build (Vite)
- `build:dev` — dev-mode build
- `preview` — preview a production build
- `lint` — run ESLint
- `test` — run Vitest

Server/automation scripts (Node):
- `agentmail:test` — run `scripts/send_agentmail_test.mjs` to exercise AgentMail integration
- `reminders:prepare` — `scripts/prepare_sample_assignments.mjs`
- `reminders:live` — live reminder loop (`scripts/send_reminders_live.mjs`) (uses TEST_* env overrides in package.json)
- `reminders:firebase` — firebase-backed reminder runner
- `drafts:send` — generate/send email drafts
- `drafts:schedule` — schedule drafts
- `seed:firebase` — seed firebase sample assignments
- `manual-send:server` — start a small local server used by the UI to send local manual reminders (used by `Index.tsx` when clicking "Send reminder")

These scripts run Node (not the browser app) and expect a properly configured environment when they touch Firebase or AgentMail.

## Environment variables
Client-side variables should be provided using a `.env.local` file (Vite exposes variables prefixed with `VITE_` to the browser). The app reads these via `import.meta.env`.

Typical variables used by the codebase:

Required for Firebase features (if you use auth/storage):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional (AI / TTS / 3rd party):
- `VITE_GEMINI_API_KEY` — (optional) used by `src/lib/aiProblemSplitter.ts`
- `VITE_GEMINI_MODEL` — model override
- `VITE_GEMINI_GUIDANCE_MODEL` — guidance model override
- `VITE_OPENAI_API_KEY` — optional fallback if you wire OpenAI in guidance
<!-- ElevenLabs/TTS environment variables removed from README as requested -->

Security note: Do not commit `.env.local`. Keys with `VITE_` are embedded in the client bundle — only use public-safe keys or guard usage via server-side calls.

## Development notes & conventions
- UI primitives are in `src/components/ui/` and follow the shadcn pattern (Tailwind utility classes and Radix primitives).
- Global state is in `src/lib/store.ts` using Zustand. Important fields include `currentPDF`, `currentProblem`, and actions like `setPDF`, `updateProblem`, `addHint`, `addAssistantMessage`.
- PDF rendering is handled by `src/components/PDFViewer.tsx` (uses `pdfjs-dist` / `react-pdf`-like tooling) and can be programmatically scrolled/highlighted by props like `highlightPage` and `forceScrollKey`.
- AI guidance code lives in `src/lib/aiGuidance.ts` and supports streaming responses in `ProblemWorkspace`.
- Local persistence (uploads) uses `src/lib/localPDFStore.ts` which serializes files and extracted text for later re-opening.

## Running the client & scripts concurrently
The client dev server runs on port 8080 by default. Some helper scripts (manual send server) are separate Node processes and may listen on other ports; check `scripts/manual_send_server.mjs` for details.

Example dev workflow

```bash
# start the client
npm run dev
# in another terminal, run the manual send server (optional, used by the UI to send reminders locally)
npm run manual-send:server
```

## Troubleshooting & common issues
- Blank PDF viewer or PDFJS worker errors: ensure `pdfjs-dist` is installed and the worker import path matches the installed version. See `src/components/PDFViewer.tsx` for how the worker is constructed.
- AI calls failing: confirm environment keys like `VITE_GEMINI_API_KEY` or `VITE_OPENAI_API_KEY` are set, and monitor quotas and CORS. The app falls back to a local heuristic parser on failures.
- Firebase auth/storage issues: ensure Firebase config env vars are present and your Firebase project is correctly configured (Auth sign-in methods, Firestore rules, Storage rules).
- Scripts that interact with Firebase or AgentMail require server-side credentials and may need additional env vars not embedded in the client. Review `scripts/` top of file comments for per-script requirements.

## Tests
Run the Vitest test suite with:

```bash
npm test
```

There are some unit tests around reminder jobs in `src/jobs/__tests__/`.

## Contributing
- Fork the repo and open small, focused PRs
- Run `npm run lint` before committing
- Add tests for logic that changes behavior (parser, reminders, time estimator)

## Acknowledgements & references
- This project uses shadcn-ui style components and Radix UI primitives
- Uses AgentMail SDK (optional) for email automation
- Uses pdfjs / react-pdf for PDF handling
