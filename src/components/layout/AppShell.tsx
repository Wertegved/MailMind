import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileSegments, Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMailMind } from '../../state/MailMindProvider';
import { isAiConfigurationUnavailable } from '../../services/ai-client';
import { UndoToast } from '../shared/UndoToast';

export interface AppShellContext {
  showToast: (message: string, undo?: () => void) => void;
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export function AppShell() {
  const { state } = useMailMind();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);
  const analyzing = state.conversations.filter((conversation) => conversation.analysisStatus === 'pending').length;
  const analyzed = state.conversations.filter((conversation) =>
    conversation.analysisStatus === 'ready' || conversation.analysisStatus === 'error',
  ).length;
  const aiNotConfigured = isAiConfigurationUnavailable();
  const failedAnalyses = aiNotConfigured ? 0 : state.conversations.filter((conversation) => conversation.analysisStatus === 'error').length;

  function showToast(message: string, undo?: () => void) {
    setToast({ id: ++toastId.current, message, undo });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <MobileSegments />
        {analyzing > 0 && (
          <div className="border-b border-brand/20 bg-brand-soft px-4 py-2 text-center text-sm font-medium text-brand-deep" role="status">
            Analyzing {analyzed} of {state.conversations.length}
          </div>
        )}
        {aiNotConfigured && (
          <div className="border-b border-review-line bg-review-soft px-4 py-2 text-center text-sm text-review" role="alert">
            AI is not configured. Your inbox is usable, but AI analysis is unavailable until the server-side API key is configured.
          </div>
        )}
        {!aiNotConfigured && failedAnalyses > 0 && (
          <div className="border-b border-review-line bg-review-soft px-4 py-2 text-center text-sm text-review" role="alert">
            {failedAnalyses} conversation{failedAnalyses === 1 ? '' : 's'} could not be analyzed. Retry them from the conversation detail.
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          <Outlet context={{ showToast } satisfies AppShellContext} />
        </main>
      </div>
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
