# MailMind

Your inbox, intelligently managed. AI-assisted email management for personal assistants and their clients.
(Prototype: simulated Gmail/Outlook onboarding and invented sample data; AI analysis, questions, and drafts use Groq.)

## Run locally
```bash
npm install
npm run dev        # Vite UI and local /api/ai endpoint
npm run build      # typecheck + production build
```

## Environment
The ignored `.env.local` file is the local place for secrets; `.env.example` documents the variables and safe defaults.
Set `GROQ_API_KEY` there for the server-side endpoint in `api/ai.ts`. The key is never sent to frontend code:
do not prefix it with `VITE_`. `GROQ_MODEL` defaults to `openai/gpt-oss-120b`; use an active chat model
available to your Groq account. Add the same variables in your Vercel project settings for deployment.

## Structure
- `src/features/onboarding/`: simulated sign-in, provider selection, permission, and sample inbox sync; the URL preserves the current step on reload, and sync restarts if interrupted
- `src/features/dashboard/`, `src/features/inbox/`, `src/features/dates/`, and `src/features/settings/`: dashboard, responsive split inbox with URL-backed search and filters, upcoming AI-derived dates, and demo settings/reset
- `shared/schemas.ts`: zod contract for AI output (shared by frontend and API)
- `src/state/`: reducer (override and reclassification rules), selectors (segments, stats, client queue), provider
- `src/data/`: 18 invented conversations; `src/services/email-demo.ts` turns them into a simulated inbox
- `src/components/`, `src/features/`: UI
