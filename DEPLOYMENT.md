# MailMind deployment checklist

This project is a Vite + React app with a local `/api/ai` endpoint for backend validation and Groq calls. The app is intended to be deployed as a single Vercel project with the frontend and serverless handler in the same codebase.

## Required environment variables

Configure the following in your Vercel project settings (or in a local `.env.local` during development):

- `GROQ_API_KEY`: server-side API key for Groq. Keep it private; never expose it to frontend code or prefix it with `VITE_`.
- `GROQ_MODEL`: model name, defaults to `openai/gpt-oss-120b`.
- `ALLOWED_ORIGINS`: comma-separated list of trusted origins allowed to call the AI endpoint. For local development this can be `http://localhost:5173`; in production use your Vercel domain(s).

Example:

```bash
GROQ_API_KEY=your_real_key_here
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=https://mailmind.example.com,https://www.mailmind.example.com,http://localhost:5173
```

## Local development

```bash
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173`, and the Vite dev server also exposes a local `/api/ai` endpoint for the mock serverless route.

## Production build and verification

```bash
npm run build
npm test
npm run check:secrets
```

The build command runs TypeScript and a production Vite build. The secret-check script scans the repository for likely credential material but ignores local environment files such as `.env.local`.

## Vercel setup

1. Import the repository into Vercel.
2. In Project Settings -> Environment Variables, add `GROQ_API_KEY`, `GROQ_MODEL`, and `ALLOWED_ORIGINS`.
3. Keep the project configured to use the default Vite build.
4. Deploy the main branch and confirm the app loads without a blank onboarding flow.
5. Open the app, complete onboarding, and verify a real AI call in the inbox or client queue succeeds.

## Smoke-test checklist

- App loads and routes to onboarding when disconnected.
- Simulated inbox sync completes and the dashboard stats render.
- AI analysis returns classifications for a sample conversation.
- Client queue and review flows show the correct status.
- Manual override and pending suggestion logic functions without stale data.
- Secret scan passes after build and before handoff.

## Operational notes

- The app is intentionally demo-oriented: it uses seeded sample data and simulated provider sync.
- AI requests are validated server-side in `api/ai.ts` before they reach Groq.
- The endpoint enforces a same-origin/allowlist check and a simple per-IP rate limit.
- If `GROQ_API_KEY` is missing, the server returns a configured-state error rather than exposing a crash.
