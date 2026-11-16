import { FlaskConical, RotateCcw, UserRound } from 'lucide-react';
import { PERSONA } from '../../data/sample-conversations';
import { clearState } from '../../services/storage';
import { useMailMind } from '../../state/MailMindProvider';
import { Button } from '../shared/Button';
import { Logo } from '../shared/Logo';
import { useNavigate } from 'react-router-dom';

export function TopBar() {
  const { state, dispatch } = useMailMind();
  const navigate = useNavigate();

  function resetDemo() {
    if (window.confirm('Reset the demo? This clears all conversations, overrides and drafts.')) {
      clearState();
      dispatch({ type: 'RESET' });
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="md:hidden"><Logo size={26} /></span>
        <p className="truncate text-sm text-ink-soft">
          <span className="font-medium text-ink">{PERSONA.client.name}</span>'s inbox · {PERSONA.company}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 whitespace-nowrap"
          onClick={() => {
            dispatch({ type: 'SET_ROLE', role: 'client' });
            navigate('/client');
          }}
        >
          <UserRound size={14} aria-hidden /> View as client
        </Button>
        <span className="hidden items-center gap-1.5 rounded-full bg-review-soft px-2.5 py-1 text-xs font-medium text-review lg:inline-flex">
          <FlaskConical size={13} aria-hidden /> Simulated email, sample data
        </span>
        {state.connection.status === 'connected' && (
          <Button size="sm" variant="ghost" onClick={resetDemo}>
            <RotateCcw size={14} aria-hidden /> Reset demo
          </Button>
        )}
      </div>
    </header>
  );
}
