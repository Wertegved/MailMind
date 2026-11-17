# MailMind demo script

This short demo is designed to show the product without depending on a live corporate inbox. It uses the seeded sample conversations in `src/data/sample-conversations.ts` so every step is deterministic and repeatable.

## 5-minute walkthrough

### 1. Onboarding and sync (30-45 seconds)

- Launch the app with `npm run dev`.
- Complete the mock onboarding flow to connect a provider.
- Choose a simulation mode and sync the seeded inbox.
- Explain that the app is using a demo inbox rather than a live Gmail/Outlook integration, which keeps the walkthrough reliable.

### 2. Dashboard overview (45-60 seconds)

- Point out the summary cards for total threads, unread, important, action required, waiting, and assistant/client response queues.
- Show the “Needs attention” column and the “Upcoming meetings” panel.
- Call out that the dashboard is driven by the same derived segment logic as the inbox, so totals and lists stay consistent.

### 3. Inbox exploration (60-90 seconds)

- Open the assistant inbox and switch between segments such as `Assistant to reply`, `Client to reply`, `Action required`, and `Waiting for response`.
- Search for a thread and show the quick filters.
- Open a conversation and explain the AI overview: responsibility, confidence, summary, action items, and dates.

### 4. Manual override and reclassification loop (45-60 seconds)

- In a conversation thread, click the classifier and change the responsibility to another value.
- Show that the UI keeps the override visible until the user decides to accept the AI suggestion or keep the override.
- Trigger a follow-up analysis or use the simulated incoming message to show the thread reclassifies or asks for review.
- Explain that the app never permanently overwrites a manual override without explicit user action.

### 5. Client queue and handled state (30-45 seconds)

- Open the client review flow to see what is waiting on the client side.
- Mark a thread as handled and reopen it to show state transitions.
- Acknowledge that the client queue is driven by the “effective client to reply” rule, not by a raw stored classification.

### 6. AI security and validation callout (15-30 seconds)

- Mention that all AI calls are validated in the server route at `api/ai.ts`.
- Note the same-origin/origin allowlist and the simple per-IP request limiter.
- Highlight that the Groq API key remains server-side only and is never exposed to the web client.

## Demo notes for the presenter

- The app is intentionally a controlled demo: it ships with invented sample data, not a production mail connector.
- Use the seeded inbox to keep the conversation flow repeatable during demos.
- If you need to show a real AI classification, set a valid `GROQ_API_KEY` in `.env.local` and restart the local dev server.
- If the AI is not configured, the app should still function in simulation mode with clear “not configured” messaging rather than crashing.

## Suggested narration

> “MailMind helps a personal assistant triage an inbox by classifying who should reply next, surfacing action items, and keeping the client queue separate from the internal assistant queue. The model is deliberately conservative: it highlights low-confidence or conflicting outputs for review and preserves manual overrides unless the user explicitly accepts the AI suggestion.”
