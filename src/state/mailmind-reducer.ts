import type {
  Actor, Analysis, Conversation, Draft, Message, Provider, Responsibility, Role, TrackedActionItem, AiResult,
} from '../types/email';
import { RESPONSIBILITY_LABEL, REVIEW_THRESHOLD } from '../utils/labels';
import { effectiveResponsibility } from './selectors';

export const STATE_VERSION = 1;

export interface AppState {
  version: typeof STATE_VERSION;
  connection: { status: 'disconnected' | 'connected'; provider?: Provider; connectedAt?: string };
  role: Role;
  conversations: Conversation[];
}

export const initialState: AppState = {
  version: STATE_VERSION,
  connection: { status: 'disconnected' },
  role: 'assistant',
  conversations: [],
};

export type Action =
  | { type: 'CONNECT'; provider: Provider; conversations: Conversation[]; now: string }
  | { type: 'RESET' }
  | { type: 'CLEAR_ACTIVITY' }
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'TOGGLE_FLAG'; id: string; flag: 'unread' | 'important' | 'archived'; now: string }
  | { type: 'SET_FLAG'; id: string; flag: 'unread' | 'important' | 'archived'; value: boolean; by: 'assistant' | 'client'; now: string }
  | { type: 'SET_COMPLETED'; id: string; completed: boolean; by: 'assistant' | 'client'; now: string }
  | { type: 'SET_OVERRIDE'; id: string; value: Responsibility; by: 'assistant' | 'client'; note?: string; now: string }
  | { type: 'CLEAR_OVERRIDE'; id: string; by: 'assistant' | 'client'; now: string }
  | { type: 'CONFIRM_REVIEW'; id: string; now: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string; now: string }
  | { type: 'KEEP_OVERRIDE'; id: string; now: string }
  | { type: 'ANALYSIS_STARTED'; id: string; requestId: string; messageCount: number }
  | { type: 'ANALYSIS_FAILED'; id: string; requestId: string; messageCount: number; error: string }
  | { type: 'APPLY_ANALYSIS'; id: string; requestId: string; messageCount: number; analysis: Analysis; now: string }
  | { type: 'ADD_MESSAGE'; id: string; message: Message }
  | { type: 'TOGGLE_ACTION_ITEM'; id: string; itemId: string }
  | { type: 'SET_DRAFT'; id: string; draft: Draft | undefined };

function log(c: Conversation, actor: Actor, text: string, at: string): Conversation {
  return { ...c, activity: [...c.activity, { id: `${c.id}-a${c.activity.length + 1}`, at, actor, text }] };
}

function track(items: Analysis['actionItems'], prev: TrackedActionItem[] = []): TrackedActionItem[] {
  return items.map((it, i) => ({
    id: `ai-${i + 1}`,
    description: it.description,
    owner: it.owner,
    dueDate: it.dueDate,
    done: prev.some((p) => p.done && p.description === it.description),
  }));
}

/**
 * The reclassification rule, in one place:
 *  - No override: effective responsibility follows the new AI result. If it changed, remember
 *    what it was (reclassifiedFrom) and log it. Low confidence re-flags the thread for review.
 *  - Override exists: the override is never replaced. If the AI now disagrees, store it as
 *    pendingSuggestion so the assistant can Accept or Keep theirs.
 */
function applyAnalysis(c: Conversation, analysis: Analysis, now: string): Conversation {
  const before = effectiveResponsibility(c);
  const ai: AiResult = {
    ...analysis,
    actionItems: track(analysis.actionItems, c.ai?.actionItems),
    analyzedAt: now,
    messageCountAtAnalysis: c.messages.length,
  };
  let next: Conversation = {
    ...c,
    ai,
    reclassifiedFrom: undefined,
    analysisStatus: 'ready',
    analysisError: undefined,
    analysisRequestId: undefined,
  };

  if (c.override) {
    const differs = analysis.responsibility !== c.override.value;
    next = { ...next, pendingSuggestion: differs ? analysis.responsibility : undefined };
    if (differs) {
      next = log(next, 'ai',
        `AI now suggests ${RESPONSIBILITY_LABEL[analysis.responsibility]}. ${RESPONSIBILITY_LABEL[c.override.value]} kept.`, now);
    }
    return next;
  }

  const lowConfidence = analysis.needsHumanReview || analysis.confidence < REVIEW_THRESHOLD;
  const sameAsBefore = c.ai?.responsibility === analysis.responsibility;
  next = {
    ...next,
    reviewState: lowConfidence ? 'needs_review' : c.reviewState === 'confirmed' && sameAsBefore ? 'confirmed' : 'none',
  };

  if (before === 'unclassified') {
    next = log(next, 'ai', `Classified as ${RESPONSIBILITY_LABEL[analysis.responsibility]} (${Math.round(analysis.confidence * 100)}%)`, now);
  } else if (before !== analysis.responsibility) {
    next = { ...next, reclassifiedFrom: before };
    next = log(next, 'ai', `Reclassified: ${RESPONSIBILITY_LABEL[before]} to ${RESPONSIBILITY_LABEL[analysis.responsibility]}`, now);
  }
  return next;
}

function update(state: AppState, id: string, fn: (c: Conversation) => Conversation): AppState {
  return { ...state, conversations: state.conversations.map((c) => (c.id === id ? fn(c) : c)) };
}

function hasInboundMessageSince(c: Conversation, messageCount: number): boolean {
  return c.messages.slice(messageCount).some((message) => message.direction === 'inbound');
}

function setFlag(c: Conversation, flag: 'unread' | 'important' | 'archived', value: boolean, by: 'assistant' | 'client', now: string): Conversation {
  if (c[flag] === value) return c;

  const text = flag === 'archived'
    ? value ? 'Archived' : 'Moved back to inbox'
    : flag === 'unread'
      ? value ? 'Marked unread' : 'Marked as read'
      : value ? 'Marked important' : 'Removed importance';
  return log({ ...c, [flag]: value }, by, text, now);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CONNECT':
      return {
        ...state,
        connection: { status: 'connected', provider: action.provider, connectedAt: action.now },
        conversations: action.conversations,
      };

    case 'RESET':
      return initialState;

    case 'CLEAR_ACTIVITY':
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.activity.length > 0 ? { ...conversation, activity: [] } : conversation,
        ),
      };

    case 'SET_ROLE':
      return { ...state, role: action.role };

    case 'TOGGLE_FLAG':
      return update(state, action.id, (c) => setFlag(c, action.flag, !c[action.flag], 'assistant', action.now));

    case 'SET_FLAG':
      return update(state, action.id, (c) => setFlag(c, action.flag, action.value, action.by, action.now));

    case 'SET_COMPLETED':
      return update(state, action.id, (c) =>
        log(
          {
            ...c,
            completed: action.completed,
            completedBy: action.completed ? action.by : undefined,
            completedAt: action.completed ? action.now : undefined,
          },
          action.by,
          action.completed ? 'Marked as handled' : 'Reopened',
          action.now,
        ),
      );

    case 'SET_OVERRIDE':
      return update(state, action.id, (c) =>
        log(
          {
            ...c,
            override: { value: action.value, by: action.by, at: action.now, note: action.note },
            pendingSuggestion: undefined,
            reclassifiedFrom: undefined,
            reviewState: 'confirmed',
          },
          action.by,
          `Set to ${RESPONSIBILITY_LABEL[action.value]}`,
          action.now,
        ),
      );

    case 'CLEAR_OVERRIDE':
      return update(state, action.id, (c) =>
        log(
          {
            ...c,
            override: undefined,
            pendingSuggestion: undefined,
            reclassifiedFrom: undefined,
            reviewState: c.ai && (c.ai.needsHumanReview || c.ai.confidence < REVIEW_THRESHOLD) ? 'needs_review' : 'none',
          },
          action.by,
          'Removed manual responsibility change',
          action.now,
        ),
      );

    case 'CONFIRM_REVIEW':
      return update(state, action.id, (c) =>
        log({ ...c, reviewState: 'confirmed' }, 'assistant', 'Confirmed the AI classification', action.now),
      );

    case 'ACCEPT_SUGGESTION':
      return update(state, action.id, (c) =>
        log(
          { ...c, override: undefined, pendingSuggestion: undefined },
          'assistant',
          c.ai ? `Accepted AI suggestion: ${RESPONSIBILITY_LABEL[c.ai.responsibility]}` : 'Accepted AI suggestion',
          action.now,
        ),
      );

    case 'KEEP_OVERRIDE':
      return update(state, action.id, (c) => log({ ...c, pendingSuggestion: undefined }, 'assistant', 'Kept manual classification', action.now));

    case 'ANALYSIS_STARTED':
      return update(state, action.id, (c) => c.messages.length === action.messageCount
        ? {
          ...c,
          analysisStatus: 'pending',
          analysisError: undefined,
          analysisRequestId: action.requestId,
        }
        : c);

    case 'ANALYSIS_FAILED':
      return update(state, action.id, (c) => {
        const matchesRequest = !c.analysisRequestId || action.requestId === undefined || c.analysisRequestId === action.requestId;
        const isFresh = !c.analysisRequestId || !hasInboundMessageSince(c, action.messageCount);
        return matchesRequest && isFresh
          ? {
            ...c,
            analysisStatus: 'error',
            analysisError: action.error,
            analysisRequestId: undefined,
          }
          : c;
      });

    case 'APPLY_ANALYSIS':
      return update(state, action.id, (c) => {
        const matchesRequest = !c.analysisRequestId || action.requestId === undefined || c.analysisRequestId === action.requestId;
        const isFresh = !c.analysisRequestId || !hasInboundMessageSince(c, action.messageCount);
        return matchesRequest && isFresh
          ? applyAnalysis(c, action.analysis, action.now)
          : c;
      });

    case 'ADD_MESSAGE':
      return update(state, action.id, (c) => {
        if (c.messages.some((message) => message.id === action.message.id)) return c;
        const inbound = action.message.direction === 'inbound';
        const base: Conversation = {
          ...c,
          messages: [...c.messages, action.message],
          lastMessageAt: action.message.sentAt,
          analysisStatus: inbound ? 'idle' : c.analysisStatus,
          unread: inbound ? true : c.unread,
          analysisRequestId: inbound ? undefined : c.analysisRequestId,
          reclassifiedFrom: inbound ? undefined : c.reclassifiedFrom,
          pendingSuggestion: inbound ? undefined : c.pendingSuggestion,
          override: inbound ? undefined : c.override,
          // A new inbound message reopens a handled or archived thread.
          completed: inbound ? false : c.completed,
          archived: inbound ? false : c.archived,
          completedBy: inbound ? undefined : c.completedBy,
          completedAt: inbound ? undefined : c.completedAt,
        };
        return log(base, inbound ? 'system' : 'assistant', inbound ? `New message from ${action.message.senderName}` : 'Reply sent', action.message.sentAt);
      });

    case 'TOGGLE_ACTION_ITEM':
      return update(state, action.id, (c) =>
        c.ai
          ? { ...c, ai: { ...c.ai, actionItems: c.ai.actionItems.map((a) => (a.id === action.itemId ? { ...a, done: !a.done } : a)) } }
          : c,
      );

    case 'SET_DRAFT':
      return update(state, action.id, (c) => ({ ...c, draft: action.draft }));
  }
}
