import { describe, expect, it } from 'vitest';
import { reducer, initialState } from './mailmind-reducer';
import { clientQueue, effectiveResponsibility, getStats, isStale, matchesSegment, needsAttention, upcomingDates } from './selectors';
import { createSampleConversations } from '../services/email-demo';
import { buildAnalysis, byId, makeState } from '../test-utils';
import type { Conversation } from '../types/email';

function baseConversation(id = 'c01') { return byId(makeState(), id); }

describe('reducer and selector behavior', () => {
  it('effective responsibility is override ?? ai.responsibility ?? unclassified and derived', () => {
    const conversation = baseConversation('c01');
    expect(effectiveResponsibility(conversation)).toBe('unclassified');
    conversation.ai = buildAnalysis({ responsibility: 'assistant_to_reply' });
    expect(effectiveResponsibility(conversation)).toBe('assistant_to_reply');
    conversation.override = { value: 'client_to_reply', by: 'assistant', at: '2025-01-15T12:00:00.000Z' };
    expect(effectiveResponsibility(conversation)).toBe('client_to_reply');
    expect('effectiveResponsibility' in conversation).toBe(false);
  });

  it('confidence < 0.75 -> reviewState needs_review; needsHumanReview true at 0.99 -> needs_review; confidence exactly 0.75 with no flag -> not flagged', () => {
    const low = reducer({ ...initialState, conversations: [baseConversation('c01')] }, {
      type: 'APPLY_ANALYSIS',
      id: 'c01',
      requestId: 'r1',
      messageCount: 1,
      analysis: buildAnalysis({ confidence: 0.74, responsibility: 'assistant_to_reply' }),
      now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(low.reviewState).toBe('needs_review');

    const highFlag = reducer({ ...initialState, conversations: [baseConversation('c01')] }, {
      type: 'APPLY_ANALYSIS',
      id: 'c01',
      requestId: 'r2',
      messageCount: 1,
      analysis: buildAnalysis({ confidence: 0.99, responsibility: 'assistant_to_reply', needsHumanReview: true }),
      now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(highFlag.reviewState).toBe('needs_review');

    const atThreshold = reducer({ ...initialState, conversations: [baseConversation('c01')] }, {
      type: 'APPLY_ANALYSIS',
      id: 'c01',
      requestId: 'r3',
      messageCount: 1,
      analysis: buildAnalysis({ confidence: 0.75, responsibility: 'assistant_to_reply', needsHumanReview: false }),
      now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(atThreshold.reviewState).toBe('none');
  });

  it('CONFIRM_REVIEW sets confirmed; a later analysis with the SAME responsibility and good confidence keeps confirmed; a later low-confidence analysis re-flags it', () => {
    const first = reducer({ ...initialState, conversations: [baseConversation('c01')] }, {
      type: 'CONFIRM_REVIEW', id: 'c01', now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(first.reviewState).toBe('confirmed');

    const same = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), reviewState: 'confirmed', ai: buildAnalysis({ responsibility: 'assistant_to_reply', confidence: 0.9 }) }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply', confidence: 0.9 }),
      now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(same.reviewState).toBe('confirmed');

    const reflagged = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), reviewState: 'confirmed', ai: buildAnalysis({ responsibility: 'assistant_to_reply', confidence: 0.9 }) }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r2', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply', confidence: 0.74, needsHumanReview: false }),
      now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(reflagged.reviewState).toBe('needs_review');
  });

  it('SET_OVERRIDE records value, by, at, optional note; clears pendingSuggestion and reclassifiedFrom; logs an activity entry', () => {
    const current = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), pendingSuggestion: 'client_to_reply', reclassifiedFrom: 'assistant_to_reply', activity: [] }] }, {
      type: 'SET_OVERRIDE', id: 'c01', value: 'assistant_to_reply', by: 'client', note: 'Need a brief delay', now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];

    expect(current.override).toEqual({ value: 'assistant_to_reply', by: 'client', at: '2025-01-15T12:00:00.000Z', note: 'Need a brief delay' });
    expect(current.pendingSuggestion).toBeUndefined();
    expect(current.reclassifiedFrom).toBeUndefined();
    expect(current.activity.at(-1)?.text).toContain('Set to Assistant to reply');
  });

  it('APPLY_ANALYSIS never changes an existing override; if the AI disagrees, pendingSuggestion is set and an activity entry is logged; if the AI agrees, pendingSuggestion is cleared', () => {
    const disagree = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), override: { value: 'client_to_reply', by: 'assistant', at: '2025-01-15T00:00:00.000Z' } }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply' }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(disagree.override).toMatchObject({ value: 'client_to_reply' });
    expect(disagree.pendingSuggestion).toBe('assistant_to_reply');
    expect(disagree.activity.at(-1)?.text).toContain('AI now suggests Assistant to reply');

    const agree = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), override: { value: 'client_to_reply', by: 'assistant', at: '2025-01-15T00:00:00.000Z' } }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r2', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'client_to_reply' }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(agree.override).toMatchObject({ value: 'client_to_reply' });
    expect(agree.pendingSuggestion).toBeUndefined();
  });

  it('ACCEPT_SUGGESTION removes the override and the effective value follows the AI; KEEP_OVERRIDE clears only pendingSuggestion; CLEAR_OVERRIDE removes the override', () => {
    const accepted = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), override: { value: 'client_to_reply', by: 'assistant', at: '2025-01-15T00:00:00.000Z' }, ai: buildAnalysis({ responsibility: 'assistant_to_reply' }) }] }, {
      type: 'ACCEPT_SUGGESTION', id: 'c01', now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(accepted.override).toBeUndefined();
    expect(effectiveResponsibility(accepted)).toBe('assistant_to_reply');

    const kept = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), pendingSuggestion: 'assistant_to_reply' }] }, {
      type: 'KEEP_OVERRIDE', id: 'c01', now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(kept.pendingSuggestion).toBeUndefined();
    expect(kept.override).toBeUndefined();

    const cleared = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), override: { value: 'client_to_reply', by: 'assistant', at: '2025-01-15T00:00:00.000Z' } }] }, {
      type: 'CLEAR_OVERRIDE', id: 'c01', by: 'assistant', now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(cleared.override).toBeUndefined();
  });

  it('first analysis of an unclassified thread logs "Classified as ..." and does not set reclassifiedFrom', () => {
    const conversation = reducer({ ...initialState, conversations: [baseConversation('c01')] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply' }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(conversation.reclassifiedFrom).toBeUndefined();
    expect(conversation.activity.at(-1)?.text).toContain('Classified as');
  });

  it('new analysis with a different responsibility and no override sets reclassifiedFrom and logs "Reclassified"', () => {
    const conversation = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), ai: buildAnalysis({ responsibility: 'assistant_to_reply' }) }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'client_to_reply' }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(conversation.reclassifiedFrom).toBe('assistant_to_reply');
    expect(conversation.activity.at(-1)?.text).toContain('Reclassified: Assistant to reply to Client to reply');
  });

  it('new analysis with the same responsibility: no reclassifiedFrom, no extra log entry', () => {
    const conversation = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), ai: buildAnalysis({ responsibility: 'assistant_to_reply' }), activity: [{ id: 'a1', actor: 'ai', at: '2025-01-15T11:00:00.000Z', text: 'Classified as Assistant to reply' }] }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply' }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(conversation.reclassifiedFrom).toBeUndefined();
    expect(conversation.activity).toHaveLength(1);
  });

  it('Action items keep their done state across re-analysis when the description is identical', () => {
    const conversation = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), ai: { ...buildAnalysis({ responsibility: 'assistant_to_reply' }), actionItems: [{ id: 'ai-1', description: 'Review RFC', owner: 'assistant', dueDate: null, done: true }] } }] }, {
      type: 'APPLY_ANALYSIS', id: 'c01', requestId: 'r1', messageCount: 1,
      analysis: buildAnalysis({ responsibility: 'assistant_to_reply', actionItems: [{ description: 'Review RFC', owner: 'assistant', dueDate: null }] }), now: '2025-01-15T12:00:00.000Z',
    }).conversations[0];
    expect(conversation.ai!.actionItems[0]?.done).toBe(true);
  });

  it('Inbound ADD_MESSAGE: unread true, lastMessageAt updated, analysisStatus idle, reopens a completed thread and un-archives an archived one, logs it', () => {
    const conversation = reducer({ ...initialState, conversations: [{ ...baseConversation('c03'), unread: false, completed: true, completedBy: 'assistant', completedAt: '2025-01-15T00:00:00.000Z', archived: true, analysisStatus: 'ready' }] }, {
      type: 'ADD_MESSAGE', id: 'c03',
      message: { id: 'c03-extra', senderName: 'Anna', senderEmail: 'anna@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T12:15:00.000Z', body: 'New inbound message' },
    }).conversations[0];

    expect(conversation.unread).toBe(true);
    expect(conversation.analysisStatus).toBe('idle');
    expect(conversation.completed).toBe(false);
    expect(conversation.completedBy).toBeUndefined();
    expect(conversation.archived).toBe(false);
    expect(conversation.activity.at(-1)?.text).toContain('New message from Anna');
  });

  it('Outbound ADD_MESSAGE: does NOT mark unread, does NOT change analysisStatus, does not reopen a completed thread', () => {
    const conversation = reducer({ ...initialState, conversations: [{ ...baseConversation('c03'), unread: false, analysisStatus: 'ready', completed: true, completedBy: 'assistant', completedAt: '2025-01-15T00:00:00.000Z' }] }, {
      type: 'ADD_MESSAGE', id: 'c03',
      message: { id: 'c03-out', senderName: 'Priya', senderEmail: 'priya@example.com', senderRole: 'assistant', direction: 'outbound', recipientRole: 'both', sentAt: '2025-01-15T13:00:00.000Z', body: 'Reply sent' },
    }).conversations[0];

    expect(conversation.unread).toBe(false);
    expect(conversation.analysisStatus).toBe('ready');
    expect(conversation.completed).toBe(true);
  });

  it('isStale: false right after analysis; true after an inbound message; still false after only outbound message', () => {
    const base = baseConversation('c03');
    const withAi = { ...base, ai: { ...buildAnalysis({ responsibility: 'assistant_to_reply' }), analyzedAt: '2025-01-15T12:00:00.000Z', messageCountAtAnalysis: base.messages.length, actionItems: [] } };
    expect(isStale(withAi)).toBe(false);

    const newInbound = { ...withAi, messages: [...withAi.messages, { id: 'extra-inbound', senderName: 'Delta', senderEmail: 'delta@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T12:30:00.000Z', body: 'Incoming' }] };
    expect(isStale(newInbound)).toBe(true);

    const outboundOnly = { ...withAi, messages: [...withAi.messages, { id: 'extra-outbound', senderName: 'Priya', senderEmail: 'priya@example.com', senderRole: 'assistant', direction: 'outbound', recipientRole: 'both', sentAt: '2025-01-15T12:30:00.000Z', body: 'Reply' }] };
    expect(isStale(outboundOnly)).toBe(false);
  });

  it('Segments and stats (use the 18 sample conversations, unanalyzed): total 18, unread 12, important 1, waiting 2 (c10 and c11), every other segment 0', () => {
    const conversations = createSampleConversations(new Date('2025-01-15T12:00:00Z'));
    expect(conversations).toHaveLength(18);
    expect(getStats(conversations)).toMatchObject({ total: 18, unread: 12, important: 1, waiting: 2 });
    expect(matchesSegment(conversations[0], 'assistant_to_reply')).toBe(false);
    expect(matchesSegment(conversations[0], 'client_to_reply')).toBe(false);
    expect(matchesSegment(conversations[0], 'no_reply_needed')).toBe(false);
    expect(matchesSegment(conversations[0], 'action_required')).toBe(false);
    expect(matchesSegment(conversations[0], 'meetings')).toBe(false);
    expect(matchesSegment(conversations[0], 'general')).toBe(false);
    expect(matchesSegment(conversations[0], 'archived')).toBe(false);
  });

  it('assistant_to_reply and client_to_reply segments require effective responsibility match AND last message inbound AND not completed AND not archived', () => {
    const assistant = { ...baseConversation('c01'), ai: buildAnalysis({ responsibility: 'assistant_to_reply' }), lastMessageAt: '2025-01-15T11:00:00.000Z', messages: [...baseConversation('c01').messages, { id: 'inbound-1', senderName: 'Alex', senderEmail: 'alex@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T11:00:00.000Z', body: 'Ping' }] };
    const client = { ...baseConversation('c02'), ai: buildAnalysis({ responsibility: 'client_to_reply' }), lastMessageAt: '2025-01-15T11:30:00.000Z', messages: [...baseConversation('c02').messages, { id: 'inbound-2', senderName: 'Jamie', senderEmail: 'jamie@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T11:30:00.000Z', body: 'Need a reply' }] };
    expect(matchesSegment(assistant, 'assistant_to_reply')).toBe(true);
    expect(matchesSegment(client, 'client_to_reply')).toBe(true);
    expect(matchesSegment({ ...assistant, completed: true }, 'assistant_to_reply')).toBe(false);
    expect(matchesSegment({ ...assistant, archived: true }, 'assistant_to_reply')).toBe(false);
    expect(matchesSegment({ ...assistant, messages: [...assistant.messages, { id: 'outbound-1', senderName: 'Priya', senderEmail: 'priya@example.com', senderRole: 'assistant', direction: 'outbound', recipientRole: 'both', sentAt: '2025-01-15T11:45:00.000Z', body: 'I sent it' }] }, 'assistant_to_reply')).toBe(false);
  });

  it('A sent reply removes a thread from the to-reply segments and puts it in waiting', () => {
    const conversation = { ...baseConversation('c10'), ai: buildAnalysis({ responsibility: 'assistant_to_reply' }), messages: [...baseConversation('c10').messages, { id: 'reply', senderName: 'Priya', senderEmail: 'priya@example.com', senderRole: 'assistant', direction: 'outbound', recipientRole: 'both', sentAt: '2025-01-15T12:00:00.000Z', body: 'We can do that' }], lastMessageAt: '2025-01-15T12:00:00.000Z' };
    expect(matchesSegment(conversation, 'assistant_to_reply')).toBe(false);
    expect(matchesSegment(conversation, 'waiting')).toBe(true);
  });

  it('no_reply_needed does not require an inbound last message', () => {
    const conversation = { ...baseConversation('c05'), ai: buildAnalysis({ responsibility: 'no_reply_needed' }), lastMessageAt: '2025-01-15T12:00:00.000Z', messages: [...baseConversation('c05').messages, { id: 'reply', senderName: 'Priya', senderEmail: 'priya@example.com', senderRole: 'assistant', direction: 'outbound', recipientRole: 'both', sentAt: '2025-01-15T12:00:00.000Z', body: 'No need to reply' }] };
    expect(matchesSegment(conversation, 'no_reply_needed')).toBe(true);
  });

  it('action_required needs at least one undone action item and not completed; ticking all items removes it', () => {
    const conversation = { ...baseConversation('c01'), ai: buildAnalysis({ responsibility: 'assistant_to_reply', actionItems: [{ description: 'Review draft', owner: 'assistant', dueDate: null }] }), completed: false };
    expect(matchesSegment(conversation, 'action_required')).toBe(true);
    const done = { ...conversation, ai: { ...conversation.ai, actionItems: [{ ...conversation.ai!.actionItems[0], done: true }] } };
    expect(matchesSegment(done, 'action_required')).toBe(false);
  });

  it('meetings: by tag meeting OR date kind meeting/appointment; general: by tag general; important: starred OR AI tag; archived threads appear only in archived and are excluded from totals and every other segment', () => {
    const meeting = { ...baseConversation('c13'), ai: buildAnalysis({ responsibility: 'assistant_to_reply', tags: ['meeting'] }) };
    const general = { ...baseConversation('c04'), ai: buildAnalysis({ responsibility: 'assistant_to_reply', tags: ['general'] }) };
    expect(matchesSegment(meeting, 'meetings')).toBe(true);
    expect(matchesSegment(general, 'general')).toBe(true);
    const important = { ...baseConversation('c02'), important: true };
    expect(matchesSegment(important, 'important')).toBe(true);
    const archived = { ...baseConversation('c03'), archived: true, important: true, ai: buildAnalysis({ responsibility: 'assistant_to_reply', tags: ['important'] }) };
    expect(matchesSegment(archived, 'archived')).toBe(true);
    expect(matchesSegment(archived, 'assistant_to_reply')).toBe(false);
    expect(getStats([archived])).toMatchObject({ total: 0, unread: 0, important: 0, waiting: 0 });
  });

  it('datedEvents drops invalid date strings and sorts ascending; needsAttention orders review-flagged first, then client-to-reply, then assistant-to-reply, then unread, and excludes completed, archived, no_reply_needed and threads where our side wrote last', () => {
    const conversations: Conversation[] = [
      { ...baseConversation('c01'), unread: true, reviewState: 'none', ai: buildAnalysis({ responsibility: 'assistant_to_reply', tags: ['important'], actionItems: [{ description: 'Follow up', owner: 'assistant', dueDate: null }] }), messages: [{ ...baseConversation('c01').messages[0], direction: 'inbound', sentAt: '2025-01-20T10:00:00.000Z' }] },
      { ...baseConversation('c02'), unread: false, reviewState: 'needs_review', ai: buildAnalysis({ responsibility: 'client_to_reply', tags: ['important'] }), messages: [{ ...baseConversation('c02').messages[0], direction: 'inbound', sentAt: '2025-01-19T10:00:00.000Z' }] },
      { ...baseConversation('c03'), unread: true, ai: buildAnalysis({ responsibility: 'assistant_to_reply', importantDates: [{ label: 'Payment due', date: 'invalid', kind: 'deadline' }, { label: 'Board call', date: '2025-01-18T09:00:00.000Z', kind: 'meeting' }, { label: 'Follow-up', date: '2025-01-17T09:00:00.000Z', kind: 'appointment' }] }) },
      { ...baseConversation('c04'), unread: false, completed: true, ai: buildAnalysis({ responsibility: 'no_reply_needed' }) },
      { ...baseConversation('c05'), archived: true, ai: buildAnalysis({ responsibility: 'assistant_to_reply' }) },
    ];

    expect(upcomingDates(conversations, new Date('2025-01-15T00:00:00.000Z')).map((item) => item.label)).toEqual(['Follow-up', 'Board call']);
    expect(needsAttention(conversations).map((item) => item.id)).toEqual(['c02', 'c01', 'c03']);
  });

  it('clientQueue returns only effective client_to_reply, last-inbound, not completed/archived threads. SET_COMPLETED by client removes it and undo restores it. Hand-over = SET_OVERRIDE {assistant_to_reply, by: client}: leaves the client queue, enters the assistant queue, and then survives an APPLY_ANALYSIS that says client_to_reply (pendingSuggestion set, override unchanged). A new inbound message on a handled client thread returns it to the client queue', () => {
    const conversations = createSampleConversations(new Date('2025-01-15T12:00:00Z'));
    const clientThread = { ...byId(conversations, 'c02'), ai: buildAnalysis({ responsibility: 'client_to_reply' }), messages: [...byId(conversations, 'c02').messages, { id: 'new-inbound', senderName: 'Client', senderEmail: 'client@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T12:00:00.000Z', body: 'Need answer' }] };
    const queue = clientQueue([clientThread]);
    expect(queue.map((item) => item.id)).toEqual(['c02']);

    const completed = reducer({ ...initialState, conversations: [clientThread] }, { type: 'SET_COMPLETED', id: 'c02', completed: true, by: 'client', now: '2025-01-15T12:00:00.000Z' }).conversations[0];
    expect(clientQueue([completed])).toHaveLength(0);

    const undone = reducer({ ...initialState, conversations: [completed] }, { type: 'SET_COMPLETED', id: 'c02', completed: false, by: 'client', now: '2025-01-15T12:01:00.000Z' }).conversations[0];
    expect(clientQueue([undone])).toHaveLength(1);

    const handedOff = reducer({ ...initialState, conversations: [clientThread] }, { type: 'SET_OVERRIDE', id: 'c02', value: 'assistant_to_reply', by: 'client', now: '2025-01-15T12:00:00.000Z' }).conversations[0];
    expect(effectiveResponsibility(handedOff)).toBe('assistant_to_reply');
    expect(matchesSegment(handedOff, 'assistant_to_reply')).toBe(true);
    expect(clientQueue([handedOff])).toHaveLength(0);

    const survived = reducer({ ...initialState, conversations: [handedOff] }, { type: 'APPLY_ANALYSIS', id: 'c02', requestId: 'r1', messageCount: 1, analysis: buildAnalysis({ responsibility: 'client_to_reply' }), now: '2025-01-15T12:05:00.000Z' }).conversations[0];
    expect(survived.override).toMatchObject({ value: 'assistant_to_reply' });
    expect(survived.pendingSuggestion).toBe('client_to_reply');

    const requeued = reducer({ ...initialState, conversations: [survived] }, { type: 'ADD_MESSAGE', id: 'c02', message: { id: 'requeued', senderName: 'Client', senderEmail: 'client@example.com', senderRole: 'external', direction: 'inbound', recipientRole: 'both', sentAt: '2025-01-15T12:10:00.000Z', body: 'Need answer again' } }).conversations[0];
    expect(clientQueue([requeued])[0]?.id).toBe('c02');
  });

  it('TOGGLE_FLAG and MARK_READ behave as specified; ANALYSIS_STARTED/FAILED set status and error; RESET returns the initial state', () => {
    const toggled = reducer({ ...initialState, conversations: [baseConversation('c01')] }, { type: 'TOGGLE_FLAG', id: 'c01', flag: 'important', now: '2025-01-15T12:00:00.000Z' }).conversations[0];
    expect(toggled.important).toBe(true);

    const flagged = reducer({ ...initialState, conversations: [baseConversation('c01')] }, { type: 'SET_FLAG', id: 'c01', flag: 'unread', value: true, by: 'assistant', now: '2025-01-15T12:00:00.000Z' }).conversations[0];
    expect(flagged.unread).toBe(true);

    const started = reducer({ ...initialState, conversations: [baseConversation('c01')] }, { type: 'ANALYSIS_STARTED', id: 'c01', requestId: 'req-1', messageCount: 1 }).conversations[0];
    expect(started.analysisStatus).toBe('pending');

    const failed = reducer({ ...initialState, conversations: [{ ...baseConversation('c01'), analysisRequestId: 'req-1' }] }, { type: 'ANALYSIS_FAILED', id: 'c01', requestId: 'req-1', messageCount: 1, error: 'It failed' }).conversations[0];
    expect(failed.analysisStatus).toBe('error');
    expect(failed.analysisError).toBe('It failed');

    expect(reducer({ ...initialState, conversations: [baseConversation('c01')] }, { type: 'RESET' })).toEqual(initialState);
  });
});
