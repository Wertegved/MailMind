import { createSampleConversations } from './services/email-demo';
import type { AiResult, Analysis, Conversation } from './types/email';

type AnalysisOverrides = Partial<Analysis> & {
  actionItems?: Analysis['actionItems'] | AiResult['actionItems'];
};

export function buildAnalysis(overrides: AnalysisOverrides = {}): AiResult {
  const { actionItems = [], ...rest } = overrides;
  return {
    responsibility: 'assistant_to_reply',
    confidence: 0.92,
    reason: 'Needs a response.',
    tags: [],
    summary: 'Summary',
    actionItems,
    importantDates: [],
    waitingOnOtherParty: false,
    needsHumanReview: false,
    analyzedAt: '2025-01-15T12:00:00.000Z',
    messageCountAtAnalysis: 1,
    ...rest,
  } as AiResult;
}

export function makeState({ now = new Date('2025-01-15T12:00:00Z') } = {}) {
  return createSampleConversations(now).map((conversation) => ({ ...conversation }));
}

export function byId(conversations: Conversation[], id: string) {
  return conversations.find((conversation) => conversation.id === id)!;
}
