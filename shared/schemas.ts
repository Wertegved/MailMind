// Shared by the frontend and (in Phase 4) the serverless function, so both sides
// agree on one contract. Everything the AI returns is validated against these.
import { z } from 'zod';

export const RESPONSIBILITIES = ['assistant_to_reply', 'client_to_reply', 'no_reply_needed'] as const;
export const ResponsibilitySchema = z.enum(RESPONSIBILITIES);
export type Responsibility = z.infer<typeof ResponsibilitySchema>;

export const TAGS = ['action_required', 'meeting', 'important', 'waiting_response', 'general'] as const;
export const TagSchema = z.enum(TAGS);
export type Tag = z.infer<typeof TagSchema>;

export const ActionItemSchema = z.object({
  description: z.string().min(1).max(240),
  owner: z.enum(['assistant', 'client', 'other']),
  dueDate: z.string().nullable().default(null),
});

export const ImportantDateSchema = z.object({
  label: z.string().min(1).max(160),
  date: z.string(), // ISO 8601
  kind: z.enum(['meeting', 'appointment', 'deadline', 'other']),
});

export const AnalysisSchema = z.object({
  responsibility: ResponsibilitySchema,
  confidence: z.number().finite().transform((n) => {
    const normalized = n > 1.5 ? n / 100 : n;
    return Math.min(1, Math.max(0, normalized));
  }),
  reason: z.string().min(1).max(400),
  tags: z.array(TagSchema).max(5).default([]),
  summary: z.string().min(1).max(700),
  actionItems: z.array(ActionItemSchema).max(8).default([]),
  importantDates: z.array(ImportantDateSchema).max(8).default([]),
  waitingOnOtherParty: z.boolean().default(false),
  needsHumanReview: z.boolean().default(false),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const ConversationContextMessageSchema = z.object({
  id: z.string().min(1).max(100),
  senderName: z.string().max(200),
  senderEmail: z.string().max(254),
  senderRole: z.enum(['external', 'assistant', 'client']),
  direction: z.enum(['inbound', 'outbound']),
  recipientRole: z.enum(['assistant', 'client', 'both']),
  sentAt: z.string().max(40),
  body: z.string().max(8_000),
});

export const ConversationContextSchema = z.object({
  id: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  messages: z.array(ConversationContextMessageSchema).min(1).max(40),
});

export const AnalyzeRequestSchema = z.object({
  action: z.literal('analyze'),
  conversation: ConversationContextSchema,
});

export const AskRequestSchema = z.object({
  action: z.literal('ask'),
  question: z.string().trim().min(1).max(1_000),
  conversations: z.array(ConversationContextSchema).min(1).max(40),
});

export const DraftRequestSchema = z.object({
  action: z.literal('draft'),
  conversation: ConversationContextSchema,
  instruction: z.string().trim().max(1_000).optional(),
});

export const AiRequestSchema = z.discriminatedUnion('action', [
  AnalyzeRequestSchema,
  AskRequestSchema,
  DraftRequestSchema,
]);

export const AskResponseSchema = z.object({
  answer: z.string().trim().min(1).max(5_000),
  conversationIds: z.array(z.string().min(1).max(100)).max(40),
});

export const DraftResponseSchema = z.object({
  body: z.string().trim().min(1).max(12_000),
});

export const AiErrorCodeSchema = z.enum([
  'bad_request',
  'forbidden',
  'too_large',
  'rate_limited',
  'not_configured',
  'ai_unavailable',
  'invalid_ai_response',
]);
export type AiErrorCode = z.infer<typeof AiErrorCodeSchema>;

export type ConversationContext = z.infer<typeof ConversationContextSchema>;
export type AskResponse = z.infer<typeof AskResponseSchema>;
export type DraftResponse = z.infer<typeof DraftResponseSchema>;
