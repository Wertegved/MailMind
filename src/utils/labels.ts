import type { Effective, Responsibility } from '../types/email';

/** Confidence below this value (or a model self-flag) sends a conversation to review. */
export const REVIEW_THRESHOLD = 0.75;

export const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  assistant_to_reply: 'Assistant to reply',
  client_to_reply: 'Client to reply',
  no_reply_needed: 'No reply needed',
};

export const EFFECTIVE_LABEL: Record<Effective, string> = {
  ...RESPONSIBILITY_LABEL,
  unclassified: 'Not analyzed yet',
};
