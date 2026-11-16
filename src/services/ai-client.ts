import {
  AiErrorCodeSchema,
  AnalysisSchema,
  AskResponseSchema,
  DraftResponseSchema,
  type AiErrorCode,
  type Analysis,
  type AskResponse,
  type ConversationContext,
  type DraftResponse,
} from '../../shared/schemas';
import type { Conversation } from '../types/email';

const MAX_CONCURRENT_REQUESTS = 3;
const CLIENT_TIMEOUT_MS = 60_000;
let activeRequests = 0;
const waitingRequests: Array<() => void> = [];
const analysisCache = new Map<string, Analysis>();
const inFlightAnalyses = new Map<string, Promise<Analysis>>();
let aiNotConfigured = false;

export class AiClientError extends Error {
  constructor(readonly code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiClientError';
  }
}

export function isAiConfigurationUnavailable(): boolean {
  return aiNotConfigured;
}

function toContext(conversation: Conversation): ConversationContext {
  return {
    id: conversation.id,
    subject: conversation.subject,
    messages: conversation.messages.slice(-40).map((message) => ({
      id: message.id,
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      senderRole: message.senderRole,
      direction: message.direction,
      recipientRole: message.recipientRole,
      sentAt: message.sentAt,
      body: message.body.slice(0, 8_000),
    })),
  };
}

async function withRequestSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => waitingRequests.push(resolve));
  }
  activeRequests += 1;
  try {
    return await operation();
  } finally {
    activeRequests -= 1;
    waitingRequests.shift()?.();
  }
}

async function postAi<T>(
  body: unknown,
  schema: { parse(value: unknown): T },
): Promise<T> {
  aiNotConfigured = false;
  const postOnce = async (): Promise<T> => withRequestSlot(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiClientError('ai_unavailable', 'The AI request timed out. Please retry.');
        }
        throw new AiClientError('ai_unavailable', 'Could not reach the AI service. Check your connection and try again.');
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new AiClientError('ai_unavailable', 'The AI endpoint returned an unexpected response. Check the local API setup and try again.');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AiClientError('ai_unavailable', 'The AI endpoint returned invalid JSON. Please retry.');
      }

      if (!response.ok) {
        const apiError = typeof payload === 'object' && payload !== null && 'error' in payload
          ? payload.error
          : undefined;
        const code = typeof apiError === 'object' && apiError !== null && 'code' in apiError
          ? AiErrorCodeSchema.safeParse(apiError.code)
          : undefined;
        const message = typeof apiError === 'object' && apiError !== null && 'message' in apiError &&
          typeof apiError.message === 'string'
          ? apiError.message
          : `The AI request failed (${response.status}).`;
        throw new AiClientError(code?.success ? code.data : 'ai_unavailable', message);
      }

      try {
        return schema.parse(payload);
      } catch {
        throw new AiClientError('invalid_ai_response', 'The AI returned an unexpected response. Please retry.');
      }
    } finally {
      window.clearTimeout(timeout);
    }
  });
  let attempt = 0;
  while (true) {
    try {
      return await postOnce();
    } catch (error) {
      const clientError = error instanceof AiClientError
        ? error
        : new AiClientError('ai_unavailable', 'The AI service is temporarily unavailable. Please try again.');
      if (clientError.code === 'not_configured') aiNotConfigured = true;
      if (clientError.code === 'rate_limited' && attempt === 0) {
        attempt += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 3_000));
        continue;
      }
      throw clientError;
    }
  }
}

export function analyzeConversation(conversation: Conversation): Promise<Analysis> {
  const context = toContext(conversation);
  const cacheKey = JSON.stringify(context);
  const cached = analysisCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const existing = inFlightAnalyses.get(cacheKey);
  if (existing) return existing;

  const request = postAi(
    { action: 'analyze', conversation: context },
    AnalysisSchema,
  ).then((analysis) => {
    analysisCache.set(cacheKey, analysis);
    if (analysisCache.size > 200) {
      const oldestKey = analysisCache.keys().next().value;
      if (oldestKey) analysisCache.delete(oldestKey);
    }
    return analysis;
  }).finally(() => inFlightAnalyses.delete(cacheKey));

  inFlightAnalyses.set(cacheKey, request);
  return request;
}

export interface AnalysisOutcome {
  id: string;
  analysis?: Analysis;
  error?: string;
  errorCode?: AiErrorCode;
  skipped?: boolean;
}

export async function analyzeConversations(
  conversations: Conversation[],
  onProgress: (completed: number, total: number) => void,
): Promise<AnalysisOutcome[]> {
  const outcomes = new Array<AnalysisOutcome>(conversations.length);
  let completed = 0;
  const reportProgress = () => {
    completed += 1;
    onProgress(completed, conversations.length);
  };
  const runOne = async (index: number): Promise<void> => {
    const conversation = conversations[index];
    try {
      outcomes[index] = { id: conversation.id, analysis: await analyzeConversation(conversation) };
    } catch (error) {
      const clientError = error instanceof AiClientError
        ? error
        : new AiClientError('ai_unavailable', 'Analysis failed. Please retry.');
      outcomes[index] = {
        id: conversation.id,
        error: clientError.message,
        errorCode: clientError.code,
      };
    } finally {
      reportProgress();
    }
  };

  if (conversations.length === 0) return outcomes;

  await runOne(0);
  if (outcomes[0]?.errorCode === 'not_configured') {
    for (let index = 1; index < conversations.length; index += 1) {
      outcomes[index] = { id: conversations[index].id, skipped: true };
      reportProgress();
    }
    return outcomes;
  }

  let nextIndex = 1;
  let stop = false;
  const worker = async () => {
    while (!stop) {
      const index = nextIndex++;
      if (index >= conversations.length) return;
      await runOne(index);
      if (outcomes[index]?.errorCode === 'not_configured') stop = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, conversations.length - 1) }, worker));
  for (let index = 1; index < conversations.length; index += 1) {
    if (!outcomes[index]) {
      outcomes[index] = { id: conversations[index].id, skipped: true };
      reportProgress();
    }
  }
  return outcomes;
}

export function askAi(question: string, conversations: Conversation[]): Promise<AskResponse> {
  const digest = conversations.filter((conversation) => !conversation.archived).slice(0, 40);
  if (digest.length === 0) {
    return Promise.reject(new AiClientError('bad_request', 'There are no active conversations to search.'));
  }
  return postAi(
    { action: 'ask', question, conversations: digest.map(toContext) },
    AskResponseSchema,
  );
}

export function draftReply(conversation: Conversation, instruction: string): Promise<DraftResponse> {
  return postAi(
    { action: 'draft', conversation: toContext(conversation), instruction },
    DraftResponseSchema,
  );
}
