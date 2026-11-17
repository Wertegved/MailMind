# MailMind

MailMind is a demo-ready email triage app for a personal assistant and their client-facing workflow. It classifies threads by who should reply next, surfaces action items and meeting dates, and keeps separate queues for assistant work and client follow-up.

## What it does

- Uses seeded conversations to simulate a modern inbox.
- Classifies each thread as `assistant_to_reply`, `client_to_reply`, or `no_reply_needed`.
- Tracks review flags, manual overrides, and suggested reclassification when a new analysis disagrees.
- Keeps an inbox plus a dedicated client queue for threads waiting on the external party.
- Surfaces upcoming meetings, important threads, and action items pulled from the AI summary.
- Exposes a local `/api/ai` endpoint that validates requests before calling Groq.

## Tech stack

- React 19 + Vite
- TypeScript
- Tailwind CSS
- Zod schemas shared between the UI and API
- Vitest + Testing Library for behavior-focused tests

## Quick start

```bash
npm install
npm run dev
```

The app runs locally with the Vite dev server. The same dev server also exposes `/api/ai` for local AI requests.

## Scripts

```bash
npm run dev          # starts Vite and the local AI proxy
npm run build        # runs TypeScript validation and a production build
npm run test         # runs the Vitest suite
npm run test:watch   # watch mode for tests
npm run check:secrets # scans the repo for likely secret material
```

## Environment and secrets

The project expects server-side credentials in `.env.local` (ignored by Git) and keeps the values out of frontend code. Use the template in `.env.example`:

```bash
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=http://localhost:5173
```

Important notes:

- Do not prefix the key with `VITE_`.
- `GROQ_API_KEY` must remain on the server side.
- `ALLOWED_ORIGINS` is used by `api/ai.ts` to reject unexpected request origins.

## Project structure

- `src/app/`: top-level routing and app shell
- `src/features/`: dashboard, inbox, client queue, settings, onboarding, upcoming dates, and design preview
- `src/state/`: reducer, selectors, and provider logic that define the app’s rules
- `src/data/`: seeded conversation fixtures used in the demo app
- `src/services/`: sample inbox generation and storage helpers
- `shared/schemas.ts`: shared AI validation contract for requests and responses
- `api/`: server-side AI handler and prompt wrappers
- `scripts/check-secrets.mjs`: repository secret scan used for pre-deploy validation

## Demo behavior

This app is intentionally demo-oriented. It ships with a prebuilt inbox and realistic seed data rather than connecting to a live provider. That keeps the app deterministic and makes it easy to demonstrate classification, override handling, reclassification, and review flows.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the checklist and environment guidance.

## Demo walkthrough

See [DEMO.md](./DEMO.md) for a five-minute demo script and presenter notes.
