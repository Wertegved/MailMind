import { useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FlaskConical, Mail, Palette, RotateCcw, UserRound } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { useMailMind } from '../../state/MailMindProvider';
import { clearState } from '../../services/storage';
import { getScriptedFollowUp, hasScriptedFollowUp } from '../../services/email-demo';
import { analyzeAndDispatch } from '../../services/analysis-runner';
import { formatDateTime } from '../../utils/dates';
import type { Role } from '../../types/email';
import type { AppShellContext } from '../../components/layout/AppShell';

const PROVIDER_LABEL = { gmail: 'Gmail', outlook: 'Outlook' } as const;
const ROLES: { value: Role; label: string; detail: string }[] = [
  { value: 'assistant', label: 'Assistant', detail: 'Manage the client inbox' },
  { value: 'client', label: 'Client', detail: 'Review the client reply queue' },
];

export function SettingsPage() {
  const { state, dispatch } = useMailMind();
  const { showToast } = useOutletContext<AppShellContext>();
  const navigate = useNavigate();
  const analysisBusyRef = useRef(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ completed: number; total: number } | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState('');
  const unanalyzed = useMemo(
    () => state.conversations.filter((conversation) => !conversation.archived && !conversation.ai),
    [state.conversations],
  );
  const scriptedConversations = state.conversations.filter((conversation) => hasScriptedFollowUp(conversation.id));

  async function runAnalysis(target: typeof state.conversations) {
    if (analysisBusyRef.current || target.length === 0) return;
    analysisBusyRef.current = true;
    setAnalysisBusy(true);
    setAnalysisNotice('');
    setAnalysisProgress({ completed: 0, total: target.length });
    try {
      const outcomes = await analyzeAndDispatch(target, dispatch, (completed, total) => {
        setAnalysisProgress({ completed, total });
      });
      const notConfigured = outcomes.some((outcome) => outcome.errorCode === 'not_configured');
      const failures = outcomes.filter((outcome) => outcome.errorCode && outcome.errorCode !== 'not_configured').length;
      setAnalysisNotice(notConfigured
        ? 'AI is not configured. Analysis stopped after one request; configure the server-side API key to analyze threads.'
        : failures > 0
          ? `${failures} thread${failures === 1 ? '' : 's'} could not be analyzed. Retry the affected threads when ready.`
          : `Analysis complete for ${outcomes.filter((outcome) => outcome.analysis).length} thread${target.length === 1 ? '' : 's'}.`);
    } catch {
      setAnalysisNotice('The analysis batch could not be completed. Please retry.');
    } finally {
      analysisBusyRef.current = false;
      setAnalysisBusy(false);
    }
  }

  function disconnectAndReset() {
    if (!window.confirm('Disconnect and reset the demo? This clears conversations, overrides and demo activity.')) return;
    clearState();
    dispatch({ type: 'RESET' });
    navigate('/onboarding', { replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-8 pt-6 sm:px-6">
      <header>
        <p className="text-sm font-medium text-brand">Workspace</p>
        <h1 data-page-title="Settings" className="mt-1 text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage the simulated connection and demo behavior.</p>
      </header>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-start gap-3 border-b border-line p-4 sm:p-5">
          <Mail size={18} className="mt-0.5 text-brand" aria-hidden />
          <div>
            <h2 className="font-semibold">Email connection</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {state.connection.provider ? `${PROVIDER_LABEL[state.connection.provider]} (simulated)` : 'No provider connected'}
            </p>
            {state.connection.connectedAt && (
              <p className="mt-1 text-xs text-ink-faint">Connected {formatDateTime(state.connection.connectedAt)}</p>
            )}
            <p className="mt-3 rounded-lg bg-review-soft px-3 py-2 text-xs text-review">
              Demo only. No real mailbox access or provider credentials are used.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 sm:p-5">
          <UserRound size={18} className="mt-0.5 text-brand" aria-hidden />
          <div className="flex-1">
            <h2 className="font-semibold">Current view</h2>
            <p className="mt-1 text-sm text-ink-muted">Choose the role used for actions and activity entries.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left transition-colors ${
                    state.role === role.value ? 'border-brand bg-brand-soft text-brand-deep' : 'border-line text-ink-soft hover:bg-canvas'
                  }`}
                  aria-pressed={state.role === role.value}
                  onClick={() => dispatch({ type: 'SET_ROLE', role: role.value })}
                >
                  <span className="block text-sm font-medium">{role.label}</span>
                  <span className="mt-0.5 block text-xs opacity-80">{role.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="ai-analysis-heading">
        <h2 id="ai-analysis-heading" className="font-semibold">AI analysis</h2>
        <p className="mt-1 text-sm text-ink-muted">Run or refresh thread analysis. Manual responsibility choices remain in effect.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={analysisBusy || unanalyzed.length === 0} onClick={() => void runAnalysis(unanalyzed)}>
            Analyze unanalyzed ({unanalyzed.length})
          </Button>
          <Button size="sm" disabled={analysisBusy || state.conversations.length === 0} onClick={() => void runAnalysis(state.conversations)}>
            Re-run on all
          </Button>
        </div>
        {analysisBusy && analysisProgress && (
          <p className="mt-3 text-sm text-ink-muted" role="status">
            Analyzing {analysisProgress.completed} of {analysisProgress.total} conversations…
          </p>
        )}
        {analysisNotice && (
          <p className="mt-3 text-sm text-review" role={analysisNotice.startsWith('Analysis complete') ? 'status' : 'alert'}>
            {analysisNotice}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <header className="flex items-start gap-3 border-b border-line p-4 sm:p-5">
          <FlaskConical size={18} className="mt-0.5 text-review" aria-hidden />
          <div>
            <h2 className="font-semibold">Demo controls</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Deliver a scripted incoming email and re-analyze the updated thread.
            </p>
          </div>
        </header>
        <ul className="divide-y divide-line">
          {scriptedConversations.map((conversation) => {
            const message = getScriptedFollowUp(conversation);
            return (
              <li key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{conversation.subject}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {message ? `New reply from ${message.senderName}` : 'Scripted reply already delivered'}
                  </span>
                </span>
                <Button
                  size="sm"
                  disabled={!message || analysisBusy}
                  onClick={() => {
                    if (message && !analysisBusyRef.current) {
                      dispatch({ type: 'ADD_MESSAGE', id: conversation.id, message });
                      showToast('Scripted reply delivered. Analysis started.');
                      void runAnalysis([{
                        ...conversation,
                        messages: [...conversation.messages, message],
                        lastMessageAt: message.sentAt,
                        analysisStatus: 'idle',
                        analysisRequestId: undefined,
                      }]);
                    }
                  }}
                >
                  {message ? 'Simulate reply' : 'Delivered'}
                </Button>
              </li>
            );
          })}
          {scriptedConversations.length === 0 && (
            <li className="px-5 py-4 text-sm text-ink-muted">No scripted replies are available for this inbox.</li>
          )}
        </ul>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Design system</h2>
          <p className="mt-1 text-sm text-ink-muted">Preview the color tokens and shared UI components.</p>
        </div>
        <Button onClick={() => navigate('/app/design')}>
          <Palette size={15} aria-hidden /> Open preview
        </Button>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Disconnect and reset</h2>
          <p className="mt-1 text-sm text-ink-muted">Clear this simulated connection and return to the welcome page.</p>
        </div>
        <Button variant="secondary" onClick={disconnectAndReset}>
          <RotateCcw size={15} aria-hidden /> Disconnect and reset
        </Button>
      </section>
    </div>
  );
}
