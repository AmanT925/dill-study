# Dill.study - AI Study Assistant

**MHacks 2025 Team Project** | [Team's Repo](https://github.com/niravjaiswal/dill-study.git)

An intelligent study workspace that parses PDF assignments into individual problems and provides AI-guided assistance with automated email reminders. Built collaboratively with my teammates who developed the PDF viewer and core UI components. Built during MHacks 2025 with a team of 4. My primary contributions: backend FastAPI endpoints for file categorization and database integration.

## My Contributions

I architected and implemented the AI and automation backend that powers Dill.study's intelligence layer.

### AI Integration & Guidance System
- **Built Gemini API integration** for intelligent PDF problem splitting (`src/lib/aiProblemSplitter.ts`)
- **Developed AI guidance system** with streaming response support (`src/lib/aiGuidance.ts`)
- **Engineered prompts** for contextual hint generation and step-by-step problem assistance
- **Integrated OpenAI** as fallback provider for reliability
- Connected AI responses to frontend chat interface and hint flow

### Email Automation & Reminder System
- **Architected AgentMail integration** for automated study reminders
- **Built Firebase-backed reminder scheduler** that tracks assignments and triggers notifications (`scripts/send_reminders_firebase.mjs`, `scripts/send_reminders_live.mjs`)
- **Developed email draft generation** and scheduling workflows (`scripts/drafts_send.mjs`, `scripts/drafts_schedule.mjs`)
- **Created manual reminder server** for UI-triggered notifications (`scripts/manual_send_server.mjs`)
- **Implemented assignment seeding utilities** for testing (`scripts/prepare_sample_assignments.mjs`, `scripts/seed_firebase_assignments.mjs`)

### Infrastructure & Testing
- Built AgentMail test harness (`scripts/send_agentmail_test.mjs`)
- Configured environment variable handling for API keys (Gemini, OpenAI, Firebase)
- Developed Node.js automation scripts for background jobs
- Created unit tests for reminder job logic

**Tech Stack:** Gemini AI API, OpenAI API, Firebase (Firestore/Auth), AgentMail, Node.js, TypeScript

## Quickstart

Prerequisites:
- Node.js 20+
- npm
```bash
git clone https://github.com/your-username/dill-study
cd dill-study
npm install
# Copy .env.example to .env.local and add your API keys
npm run dev
