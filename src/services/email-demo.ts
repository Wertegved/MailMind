// Simulated email provider: turns seed data into conversations with timestamps relative to "now".
import { SEED_CONVERSATIONS, type SeedMessage } from '../data/sample-conversations';
import type { Conversation, Message } from '../types/email';

function toMessage(convId: string, index: number, seed: SeedMessage, sentAt: Date): Message {
  return {
    id: `${convId}-m${index + 1}`,
    senderName: seed.name,
    senderEmail: seed.email,
    senderRole: seed.who === 'ext' ? 'external' : seed.who,
    direction: seed.who === 'ext' ? 'inbound' : 'outbound',
    recipientRole: seed.to,
    sentAt: sentAt.toISOString(),
    body: seed.body,
  };
}

export function createSampleConversations(now: Date = new Date()): Conversation[] {
  return SEED_CONVERSATIONS.map((seed) => {
    const messages = seed.messages.map((m, i) =>
      toMessage(seed.id, i, m, new Date(now.getTime() - m.minutesAgo * 60000)),
    );
    return {
      id: seed.id,
      subject: seed.subject,
      messages,
      lastMessageAt: messages[messages.length - 1].sentAt,
      analysisStatus: 'idle',
      reviewState: 'none',
      unread: Boolean(seed.unread),
      important: Boolean(seed.important),
      archived: false,
      completed: false,
      activity: [],
    };
  });
}

/** Returns the scripted incoming message for a thread, or undefined if it has none. */
export function getScriptedFollowUp(conv: Conversation, now: Date = new Date()): Message | undefined {
  const seed = SEED_CONVERSATIONS.find((s) => s.id === conv.id)?.followUp;
  if (!seed || conv.messages.some((message) => message.id === `${conv.id}-follow-up`)) return undefined;
  return { ...toMessage(conv.id, conv.messages.length, { ...seed, minutesAgo: 0 }, now), id: `${conv.id}-follow-up` };
}

export function hasScriptedFollowUp(convId: string): boolean {
  return Boolean(SEED_CONVERSATIONS.find((s) => s.id === convId)?.followUp);
}
