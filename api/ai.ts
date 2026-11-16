import {
  AiRequestSchema,
  AnalysisSchema,
  AskResponseSchema,
  DraftResponseSchema,
  type AiErrorCode,
} from '../shared/schemas.ts';
import { z } from 'zod';
import { callGroq, GroqRequestError } from './_lib/groq.ts';
import { buildPrompt } from './_lib/prompts.ts';

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

class ApiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MAX_BODY_BYTES = 64_000;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map<string, { startedAt: number; count: number }>();
type AiRequest = z.infer<typeof AiRequestSchema>;

function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function respond(res: ApiResponse, status: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(body);
}

function fail(res: ApiResponse, error: ApiError): void {
  respond(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
}

function checkOrigin(req: ApiRequest, environment: Record<string, string | undefined>): void {
  const origin = header(req, 'origin');
  const host = header(req, 'host');
  if (!origin || !host) throw new ApiError('forbidden', 403, 'Request origin is not allowed.');

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new ApiError('forbidden', 403, 'Request origin is not allowed.');
  }

  const allowedOrigins = (environment.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const sameHost = parsedOrigin.host.toLowerCase() === host.toLowerCase();
  if (!sameHost && !allowedOrigins.includes(parsedOrigin.origin)) {
    throw new ApiError('forbidden', 403, 'Request origin is not allowed.');
  }
}

function clientIp(req: ApiRequest): string {
  const forwarded = header(req, 'x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(req: ApiRequest): void {
  const now = Date.now();
  const ip = clientIp(req);
  let bucket = rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    rateLimitBuckets.set(ip, bucket);
  }
  bucket.count += 1;

  if (rateLimitBuckets.size > 5_000) {
    for (const [key, entry] of rateLimitBuckets) {
      if (now - entry.startedAt >= RATE_WINDOW_MS) rateLimitBuckets.delete(key);
    }
  }

  if (bucket.count > RATE_LIMIT) {
    throw new ApiError('rate_limited', 429, 'Too many AI requests. Please try again shortly.');
  }
}

function parseRequestBody(body: unknown, contentLength?: string): AiRequest {
  const declaredSize = contentLength ? Number(contentLength) : 0;
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    throw new ApiError('too_large', 413, 'Request is too large.');
  }

  let parsedBody = body;
  if (typeof body === 'string') {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      throw new ApiError('bad_request', 400, 'Request body must be valid JSON.');
    }
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(parsedBody ?? null);
  } catch {
    throw new ApiError('bad_request', 400, 'Request body must be valid JSON.');
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
    throw new ApiError('too_large', 413, 'Request is too large.');
  }

  const request = AiRequestSchema.safeParse(parsedBody);
  if (!request.success) throw new ApiError('bad_request', 400, 'Invalid AI request.');
  return request.data;
}

function validateOutput(action: AiRequest['action'], text: string, allowedIds: Set<string>): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response.');
  }

  if (action === 'analyze') return AnalysisSchema.parse(value);
  if (action === 'draft') return DraftResponseSchema.parse(value);
  const result = AskResponseSchema.parse(value);
  return {
    ...result,
    conversationIds: result.conversationIds.filter((id) => allowedIds.has(id)),
  };
}

function validationHint(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || 'response'} (${issue.code})`)
      .join(', ');
  }
  return error instanceof Error ? error.message : 'Invalid JSON response.';
}

async function structuredCompletion(
  request: AiRequest,
  model: string,
  apiKey: string,
  allowedIds: Set<string>,
): Promise<unknown> {
  const maxTokens = request.action === 'analyze' ? 2_000 : 1_000;
  const messages = buildPrompt(request);
  const firstText = await callGroq(messages, model, apiKey, maxTokens);
  try {
    return validateOutput(request.action, firstText, allowedIds);
  } catch (error) {
    const repairMessages = [
      ...messages,
      { role: 'assistant' as const, content: firstText.slice(0, 12_000) },
      {
        role: 'user' as const,
        content: `Repair the previous response. Schema validation failed at: ${validationHint(error)}. Return only one valid JSON object matching the exact fields, types, and allowed enum values in the original instructions.`,
      },
    ];
    const repairedText = await callGroq(repairMessages, model, apiKey, maxTokens);
    try {
      return validateOutput(request.action, repairedText, allowedIds);
    } catch {
      throw new ApiError('invalid_ai_response', 502, 'The AI returned an invalid response. Please retry.');
    }
  }
}

function mapGroqError(error: GroqRequestError): ApiError {
  if (error.status === 401 || error.status === 403) {
    return new ApiError('not_configured', 503, 'Groq rejected the API key. Check GROQ_API_KEY on the server.');
  }
  if (error.status === 404) {
    return new ApiError('ai_unavailable', 503, 'The configured Groq model is unavailable. Set GROQ_MODEL to an active model.');
  }
  if (error.status === 400) {
    return new ApiError('ai_unavailable', 503, 'Groq rejected the model request. Check that GROQ_MODEL supports JSON responses.');
  }
  if (error.status === 429) {
    return new ApiError('rate_limited', 429, 'The AI service is busy. Please try again shortly.');
  }
  return new ApiError('ai_unavailable', 503, 'The AI service is temporarily unavailable. Please try again.');
}

export async function handleAiRequest(
  req: ApiRequest,
  res: ApiResponse,
  environment: Record<string, string | undefined> = process.env,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    fail(res, new ApiError('bad_request', 405, 'Method not allowed. Use POST.'));
    return;
  }

  try {
    checkOrigin(req, environment);
    checkRateLimit(req);
    const request = parseRequestBody(req.body, header(req, 'content-length'));
    const apiKey = environment.GROQ_API_KEY;
    if (!apiKey?.trim()) throw new ApiError('not_configured', 503, 'AI is not configured.');

    const model = environment.GROQ_MODEL || 'openai/gpt-oss-120b';
    const allowedIds = request.action === 'ask'
      ? new Set(request.conversations.map((conversation) => conversation.id))
      : new Set([request.conversation.id]);
    const result = await structuredCompletion(request, model, apiKey, allowedIds);
    respond(res, 200, result);
  } catch (error) {
    if (error instanceof ApiError) {
      fail(res, error);
      return;
    }
    if (error instanceof GroqRequestError) {
      fail(res, mapGroqError(error));
      return;
    }
    fail(res, new ApiError('ai_unavailable', 503, 'The AI service is temporarily unavailable. Please try again.'));
  }
}

export default function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  return handleAiRequest(req, res);
}
