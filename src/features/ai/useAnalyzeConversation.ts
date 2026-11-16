import { useCallback } from 'react';
import { analyzeConversation } from '../../services/ai-client';
import { useMailMind } from '../../state/MailMindProvider';
import type { Conversation } from '../../types/email';

let nextRequestId = 0;
const inFlightAnalysisKeys = new Set<string>();

export function useAnalyzeConversation() {
  const { dispatch } = useMailMind();

  return useCallback((conversation: Conversation) => {
    if (conversation.analysisStatus === 'pending') return;
    const analysisKey = `${conversation.id}:${conversation.messages.length}:${conversation.lastMessageAt}`;
    if (inFlightAnalysisKeys.has(analysisKey)) return;
    inFlightAnalysisKeys.add(analysisKey);
    const requestId = `${conversation.id}-${Date.now()}-${++nextRequestId}`;
    const messageCount = conversation.messages.length;
    dispatch({ type: 'ANALYSIS_STARTED', id: conversation.id, requestId, messageCount });

    void analyzeConversation(conversation).then((analysis) => {
      dispatch({
        type: 'APPLY_ANALYSIS',
        id: conversation.id,
        requestId,
        messageCount,
        analysis,
        now: new Date().toISOString(),
      });
    }).catch((error: unknown) => {
      dispatch({
        type: 'ANALYSIS_FAILED',
        id: conversation.id,
        requestId,
        messageCount,
        error: error instanceof Error ? error.message : 'Analysis failed. Please retry.',
      });
    }).finally(() => inFlightAnalysisKeys.delete(analysisKey));
  }, [dispatch]);
}
