import type { Dispatch } from 'react';
import type { Conversation } from '../types/email';
import type { Action } from '../state/mailmind-reducer';
import { analyzeConversations } from './ai-client';

let nextBatchId = 0;
let activeBatches = 0;

export function isAnalysisBatchRunning(): boolean {
  return activeBatches > 0;
}

export async function analyzeAndDispatch(
  conversations: Conversation[],
  dispatch: Dispatch<Action>,
  onProgress: (completed: number, total: number) => void = () => {},
) {
  activeBatches += 1;
  try {
    const requestIds = new Map<string, { requestId: string; messageCount: number }>();
    const batchId = ++nextBatchId;

    for (const [index, conversation] of conversations.entries()) {
      const requestId = `batch-${batchId}-${index}-${Date.now()}`;
      const messageCount = conversation.messages.length;
      requestIds.set(conversation.id, { requestId, messageCount });
      dispatch({ type: 'ANALYSIS_STARTED', id: conversation.id, requestId, messageCount });
    }

    const outcomes = await analyzeConversations(conversations, onProgress);
    for (const outcome of outcomes) {
      const conversation = conversations.find((item) => item.id === outcome.id);
      const request = requestIds.get(outcome.id);
      if (!conversation || !request) continue;

      if (outcome.analysis) {
        dispatch({
          type: 'APPLY_ANALYSIS',
          id: outcome.id,
          requestId: request.requestId,
          messageCount: request.messageCount,
          analysis: outcome.analysis,
          now: new Date().toISOString(),
        });
      } else {
        dispatch({
          type: 'ANALYSIS_FAILED',
          id: outcome.id,
          requestId: request.requestId,
          messageCount: request.messageCount,
          error: outcome.skipped ? 'Analysis skipped because AI is not configured.' : outcome.error || 'Analysis failed. Please retry.',
        });
      }
    }
    return outcomes;
  } finally {
    activeBatches -= 1;
  }
}
