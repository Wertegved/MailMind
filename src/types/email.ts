import type { Analysis, Responsibility } from '../../shared/schemas';

export type { Analysis, Responsibility };

/** What the app actually uses: override ?? AI suggestion ?? unclassified. Never stored. */
export type Effective = Responsibility | 'unclassified';

export type Direction = 'inbound' | 'outbound';
export type SenderRole = 'external' | 'assistant' | 'client';
/** Which of our people an inbound message is addressed to. Outbound messages use 'both'. */
export type RecipientRole = 'assistant' | 'client' | 'both';
export type Actor = 'assistant' | 'client' | 'ai' | 'system';
export type Provider = 'gmail' | 'outlook';
export type Role = 'assistant' | 'client';

export interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  senderRole: SenderRole;
  direction: Direction;
  recipientRole: RecipientRole;
  sentAt: string; // ISO
  body: string; // plain text; always rendered as text, never HTML
}

export interface TrackedActionItem {
  id: string;
  description: string;
  owner: 'assistant' | 'client' | 'other';
  dueDate: string | null;
  done: boolean;
}

/** The AI's suggestion. Kept separate from the effective classification. */
export interface AiResult extends Omit<Analysis, 'actionItems'> {
  actionItems: TrackedActionItem[];
  analyzedAt: string;
  messageCountAtAnalysis: number;
}

export interface Override {
  value: Responsibility;
  by: 'assistant' | 'client';
  at: string;
  note?: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: Actor;
  text: string;
}

export interface Draft {
  body: string;
  generatedAt: string;
  edited: boolean;
}

export interface Conversation {
  id: string;
  subject: string;
  messages: Message[];
  lastMessageAt: string;

  ai?: AiResult;
  analysisStatus: 'idle' | 'pending' | 'ready' | 'error';
  analysisError?: string;
  analysisRequestId?: string;

  override?: Override;
  /** Set when a new AI result disagrees with an existing override. Shown as Accept / Keep mine. */
  pendingSuggestion?: Responsibility;
  /** Set when the effective classification changed because a new message arrived. */
  reclassifiedFrom?: Responsibility;
  reviewState: 'none' | 'needs_review' | 'confirmed';

  unread: boolean;
  important: boolean;
  archived: boolean;
  completed: boolean;
  completedBy?: 'assistant' | 'client';
  completedAt?: string;

  draft?: Draft;
  activity: ActivityEntry[];
}
