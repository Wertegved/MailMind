import { useRef, useState } from 'react';
import { CheckCircle2, UserRound } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { useMailMind } from '../../state/MailMindProvider';
import type { Conversation } from '../../types/email';
import type { ClientShellContext } from '../../components/layout/ClientShell';

let lastClientActionAt = 0;

export function ClientActions({
  conversation,
  returnToQueue = false,
}: {
  conversation: Conversation;
  returnToQueue?: boolean;
}) {
  const { dispatch } = useMailMind();
  const { showToast } = useOutletContext<ClientShellContext>();
  const navigate = useNavigate();
  const actionInFlightRef = useRef(false);
  const [actionInFlight, setActionInFlight] = useState(false);

  function beginAction(): boolean {
    const now = Date.now();
    if (actionInFlightRef.current || now - lastClientActionAt < 500) return false;
    lastClientActionAt = now;
    actionInFlightRef.current = true;
    setActionInFlight(true);
    return true;
  }

  function finishAction(message: string, undo: () => void) {
    showToast(message, () => {
      lastClientActionAt = 0;
      undo();
    });
    if (returnToQueue) navigate('/client');
  }

  function markHandled() {
    if (!beginAction()) return;
    dispatch({
      type: 'SET_COMPLETED',
      id: conversation.id,
      completed: true,
      by: 'client',
      now: new Date().toISOString(),
    });
    finishAction('Conversation marked handled', () => dispatch({
      type: 'SET_COMPLETED',
      id: conversation.id,
      completed: false,
      by: 'client',
      now: new Date().toISOString(),
    }));
  }

  function askAssistantToTakeOver() {
    if (!beginAction()) return;
    dispatch({
      type: 'SET_OVERRIDE',
      id: conversation.id,
      value: 'assistant_to_reply',
      by: 'client',
      note: 'Client asked the assistant to take over',
      now: new Date().toISOString(),
    });
    finishAction('Asked your assistant to take over', () => dispatch({
      type: 'CLEAR_OVERRIDE',
      id: conversation.id,
      by: 'client',
      now: new Date().toISOString(),
    }));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button className="min-h-11 w-full sm:w-auto" onClick={markHandled} disabled={actionInFlight}>
        <CheckCircle2 size={16} aria-hidden /> Mark handled
      </Button>
      <Button className="min-h-11 w-full sm:w-auto" variant="secondary" onClick={askAssistantToTakeOver} disabled={actionInFlight}>
        <UserRound size={16} aria-hidden /> Ask assistant to take over
      </Button>
    </div>
  );
}
