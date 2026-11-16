// All segment / stat / queue logic lives here so every screen agrees on the numbers.
import type { Conversation, Effective, Message } from '../types/email';

export const SEGMENTS = [
  { id: 'all', label: 'All conversations' },
  { id: 'assistant_to_reply', label: 'Assistant to reply' },
  { id: 'client_to_reply', label: 'Client to reply' },
  { id: 'no_reply_needed', label: 'No reply needed' },
  { id: 'action_required', label: 'Action required' },
  { id: 'waiting', label: 'Waiting for response' },
  { id: 'meetings', label: 'Meetings & appointments' },
  { id: 'important', label: 'Important' },
  { id: 'general', label: 'General' },
  { id: 'archived', label: 'Archived' },
] as const;

export type SegmentId = (typeof SEGMENTS)[number]['id'];

export function isSegmentId(v: string | undefined): v is SegmentId {
  return SEGMENTS.some((s) => s.id === v);
}

/** override ?? AI suggestion ?? unclassified. Derived, never stored. */
export function effectiveResponsibility(c: Conversation): Effective {
  return c.override?.value ?? c.ai?.responsibility ?? 'unclassified';
}

export const lastMessage = (c: Conversation): Message => c.messages[c.messages.length - 1];
export const isAwaitingOurReply = (c: Conversation): boolean => lastMessage(c).direction === 'inbound';

export function isStale(c: Conversation): boolean {
  if (!c.ai) return false;
  return c.messages
    .slice(c.ai.messageCountAtAnalysis)
    .some((message) => message.direction === 'inbound');
}

export function counterpart(c: Conversation): { name: string; email: string } {
  const m = c.messages.find((x) => x.senderRole === 'external') ?? c.messages[0];
  return { name: m.senderName, email: m.senderEmail };
}

export function matchesSegment(c: Conversation, segment: SegmentId): boolean {
  if (segment === 'archived') return c.archived;
  if (c.archived) return false;

  const eff = effectiveResponsibility(c);
  const tags = c.ai?.tags ?? [];

  switch (segment) {
    case 'all':
      return true;
    case 'assistant_to_reply':
    case 'client_to_reply':
      // Only threads where the ball is in our court: last message inbound, not completed.
      return eff === segment && isAwaitingOurReply(c) && !c.completed;
    case 'no_reply_needed':
      return eff === 'no_reply_needed';
    case 'action_required':
      return !c.completed && Boolean(c.ai?.actionItems.some((a) => !a.done));
    case 'waiting':
      return !isAwaitingOurReply(c) || Boolean(c.ai?.waitingOnOtherParty);
    case 'meetings':
      return (
        tags.includes('meeting') ||
        Boolean(c.ai?.importantDates.some((d) => d.kind === 'meeting' || d.kind === 'appointment'))
      );
    case 'important':
      return c.important || tags.includes('important');
    case 'general':
      return tags.includes('general');
  }
}

export const segmentCount = (cs: Conversation[], segment: SegmentId): number =>
  cs.filter((c) => matchesSegment(c, segment)).length;

export const byRecent = (a: Conversation, b: Conversation): number =>
  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

export function getStats(cs: Conversation[]) {
  const active = cs.filter((c) => !c.archived);
  return {
    total: active.length, // conversation threads, not individual messages
    unread: active.filter((c) => c.unread).length,
    important: segmentCount(cs, 'important'),
    actionRequired: segmentCount(cs, 'action_required'),
    waiting: segmentCount(cs, 'waiting'),
    assistantToReply: segmentCount(cs, 'assistant_to_reply'),
    clientToReply: segmentCount(cs, 'client_to_reply'),
  };
}

/** What the client sees: effective "client to reply", still awaiting a reply, not handled. */
export const clientQueue = (cs: Conversation[]): Conversation[] =>
  cs
    .filter((c) => matchesSegment(c, 'client_to_reply'))
    .sort((a, b) => Number(matchesSegment(b, 'important')) - Number(matchesSegment(a, 'important')) || byRecent(a, b));

export function needsAttention(cs: Conversation[]): Conversation[] {
  return cs
    .filter((c) => {
      if (c.archived || c.completed) return false;
      const responsibility = effectiveResponsibility(c);
      return c.unread || c.important ||
        c.reviewState === 'needs_review' ||
        Boolean(c.ai?.tags.includes('important')) ||
        Boolean(c.ai?.actionItems.some((item) => !item.done)) ||
        ((responsibility === 'assistant_to_reply' || responsibility === 'client_to_reply') && isAwaitingOurReply(c));
    })
    .sort(byRecent);
}

export interface UpcomingDate {
  conversationId: string;
  subject: string;
  senderName: string;
  label: string;
  date: string;
  kind: 'meeting' | 'appointment' | 'deadline' | 'other';
}

export function upcomingDates(cs: Conversation[], now: number = Date.now()): UpcomingDate[] {
  return cs
    .filter((c) => !c.archived)
    .flatMap((c) => (c.ai?.importantDates ?? [])
      .filter((date) => {
        const time = new Date(date.date).getTime();
        return Number.isFinite(time) && time >= now;
      })
      .map((date) => ({
        conversationId: c.id,
        subject: c.subject,
        senderName: counterpart(c).name,
        label: date.label,
        date: date.date,
        kind: date.kind,
      })))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function recentActivity(cs: Conversation[], limit = 8) {
  return cs
    .flatMap((conversation) => conversation.activity.map((entry) => ({ conversation, entry })))
    .sort((a, b) => new Date(b.entry.at).getTime() - new Date(a.entry.at).getTime())
    .slice(0, limit);
}
