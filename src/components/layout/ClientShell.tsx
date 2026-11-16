import { useEffect, useRef, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PERSONA } from '../../data/sample-conversations';
import { useMailMind } from '../../state/MailMindProvider';
import { UndoToast } from '../shared/UndoToast';

export interface ClientShellContext {
  showToast: (message: string, undo?: () => void) => void;
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export function ClientShell() {
  const { dispatch } = useMailMind();
  const navigate = useNavigate();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    dispatch({ type: 'SET_ROLE', role: 'client' });
  }, [dispatch]);

  function showToast(message: string, undo?: () => void) {
    setToast({ id: ++toastId.current, message, undo });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-client/20 bg-client-soft px-4 py-2 sm:px-6">
        <p className="text-sm font-medium text-client">Viewing as {PERSONA.client.name}</p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-client hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-client focus-visible:outline-offset-2"
          onClick={() => {
            dispatch({ type: 'SET_ROLE', role: 'assistant' });
            navigate('/app/dashboard');
          }}
        >
          <ArrowLeft size={15} aria-hidden /> Back to assistant view
        </button>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Outlet context={{ showToast } satisfies ClientShellContext} />
      </main>
      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={toast.undo ? () => { toast.undo?.(); setToast(null); } : undefined}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
