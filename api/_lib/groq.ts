const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqRequestError extends Error {
  constructor(readonly status?: number, readonly timedOut = false) {
    super(timedOut ? 'The AI request timed out.' : 'The AI provider request failed.');
    this.name = 'GroqRequestError';
  }
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export async function callGroq(
  messages: GroqMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    let response: Response;
    try {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new GroqRequestError(undefined, error instanceof Error && error.name === 'AbortError');
    }

    if (!response.ok) throw new GroqRequestError(response.status);

    let payload: GroqResponse;
    try {
      payload = await response.json() as GroqResponse;
    } catch {
      throw new GroqRequestError();
    }
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (content === null) return '';
    throw new GroqRequestError();
  } finally {
    clearTimeout(timeout);
  }
}
