import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Check, CheckCircle2, ChevronLeft, CloudDownload, Mail, ShieldCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsibilityPill } from '../../components/email/ResponsibilityPill';
import { Button } from '../../components/shared/Button';
import { Logo } from '../../components/shared/Logo';
import { PERSONA, SEED_CONVERSATIONS } from '../../data/sample-conversations';
import { createSampleConversations } from '../../services/email-demo';
import { analyzeAndDispatch } from '../../services/analysis-runner';
import { useMailMind } from '../../state/MailMindProvider';
import type { Conversation, Provider } from '../../types/email';

type Step = 'welcome' | 'sign_in' | 'provider' | 'permission' | 'connected' | 'sync';

const PROVIDER_LABEL: Record<Provider, string> = { gmail: 'Gmail', outlook: 'Outlook' };
const STEPS: Step[] = ['welcome', 'sign_in', 'provider', 'permission', 'connected', 'sync'];

function isProvider(value: string | null): value is Provider {
  return value === 'gmail' || value === 'outlook';
}

export function Onboarding() {
  const { dispatch } = useMailMind();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStep = searchParams.get('step');
  const parsedStep = STEPS.find((value) => value === requestedStep) ?? 'welcome';
  const rawProvider = searchParams.get('provider');
  const provider = isProvider(rawProvider) ? rawProvider : undefined;
  const step = ['permission', 'connected', 'sync'].includes(parsedStep) && !provider ? 'welcome' : parsedStep;
  const conversations = useMemo(() => createSampleConversations(), [step, provider]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisFailures, setAnalysisFailures] = useState(0);
  const [analysisNotConfigured, setAnalysisNotConfigured] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'syncing' | 'analyzing' | 'complete'>('syncing');
  const skippedToDashboard = useRef(false);

  function goToStep(nextStep: Step, nextProvider = provider) {
    const params = new URLSearchParams();
    if (nextStep !== 'welcome') params.set('step', nextStep);
    if (nextProvider) params.set('provider', nextProvider);
    setSearchParams(params, { replace: true });
    if (nextStep === 'sync') setSyncProgress(0);
  }

  useEffect(() => {
    if (step !== 'sync' || !provider) return;

    const selectedProvider = provider;
    let cancelled = false;
    setSyncProgress(0);
    setAnalysisProgress(0);
    setAnalysisFailures(0);
    setAnalysisNotConfigured(false);
    skippedToDashboard.current = false;
    setSyncPhase('syncing');

    async function syncSampleInbox() {
      const synced: Conversation[] = [];
      for (const conversation of conversations) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
        if (cancelled) return;
        synced.push(conversation);
        setSyncProgress(synced.length);
      }

      if (cancelled) return;
      setSyncPhase('analyzing');
      dispatch({
        type: 'CONNECT',
        provider: selectedProvider,
        conversations: synced,
        now: new Date().toISOString(),
      });
      const outcomes = await analyzeAndDispatch(synced, dispatch, (completed) => {
        if (!cancelled) setAnalysisProgress(completed);
      });
      const failures = outcomes.filter((outcome) => outcome.errorCode !== undefined);
      if (cancelled) return;
      setAnalysisNotConfigured(failures.some((outcome) => outcome.errorCode === 'not_configured'));
      setAnalysisFailures(failures.filter((outcome) => outcome.errorCode !== 'not_configured').length);
      if (failures.length > 0) {
        setSyncPhase('complete');
        return;
      }
      if (!skippedToDashboard.current) navigate('/app/dashboard', { replace: true });
    }

    void syncSampleInbox();
    return () => { cancelled = true; };
  }, [conversations, dispatch, navigate, provider, step]);

  const syncTotal = SEED_CONVERSATIONS.length;
  const currentProgress = syncPhase === 'syncing' ? syncProgress : analysisProgress;
  const progressPercent = syncTotal ? Math.round((currentProgress / syncTotal) * 100) : 0;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full items-center justify-center bg-canvas px-4 py-8 sm:px-6">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-center gap-2.5">
          <Logo size={34} />
          <span className="font-display text-xl font-semibold">MailMind</span>
          <span className="rounded-full bg-review-soft px-2.5 py-1 text-xs font-medium text-review">SIMULATED</span>
        </header>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-raised">
          {step === 'welcome' && (
            <div className="grid gap-8 p-6 sm:grid-cols-2 sm:items-center sm:p-9">
              <div>
                <p className="text-sm font-medium text-brand">Your inbox, intelligently managed.</p>
                <h1 data-page-title="Welcome" className="mt-2 text-3xl font-semibold">Make every thread clear.</h1>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  See who needs to reply at a glance. MailMind helps assistants and clients stay in sync.
                </p>
                <Button variant="primary" className="mt-6" onClick={() => goToStep('sign_in', undefined)}>
                  Get started <ArrowRight size={16} aria-hidden />
                </Button>
                <p className="mt-3 text-xs text-ink-faint">A demo experience with invented sample emails.</p>
              </div>

              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">One clear next step</p>
                <div className="space-y-3 rounded-lg bg-surface p-4 shadow-raised">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Mail size={17} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">Maya Lindqvist</p>
                      <p className="truncate text-sm text-ink-soft">Can we move Thursday&apos;s call?</p>
                      <p className="mt-1 truncate text-xs text-ink-muted">Would Friday at 3pm work instead?</p>
                    </div>
                  </div>
                  <ResponsibilityPill value="assistant_to_reply" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                  <CheckCircle2 size={15} className="text-ok" aria-hidden />
                  Understand responsibility without opening every thread
                </div>
              </div>
            </div>
          )}

          {step === 'sign_in' && (
            <div className="mx-auto max-w-md p-6 sm:p-9">
              <BackButton onClick={() => goToStep('welcome', undefined)} />
              <StepHeading title="Welcome to MailMind" subtitle="Sign in to continue to your simulated workspace." />
              <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Demo account</p>
                <p className="mt-2 text-sm font-semibold">{PERSONA.assistant.name}</p>
                <p className="text-sm text-ink-muted">{PERSONA.assistant.email}</p>
              </div>
              <Button variant="primary" className="mt-5 w-full" onClick={() => goToStep('provider', undefined)}>
                Continue as {PERSONA.assistant.name} <ArrowRight size={16} aria-hidden />
              </Button>
              <p className="mt-3 text-center text-xs text-ink-faint">No password or account data is collected.</p>
            </div>
          )}

          {step === 'provider' && (
            <div className="mx-auto max-w-md p-6 sm:p-9">
              <BackButton onClick={() => goToStep('sign_in', undefined)} />
              <StepHeading title="Choose your email provider" subtitle="Connect a simulated inbox to explore MailMind." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(['gmail', 'outlook'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => goToStep('permission', value)}
                    className="flex min-h-28 flex-col items-start justify-between rounded-xl border border-line p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-brand">
                      <Mail size={18} aria-hidden />
                    </span>
                    <span className="mt-4 flex w-full items-center justify-between gap-2">
                      <span className="font-medium">{PROVIDER_LABEL[value]}</span>
                      <span className="rounded-full bg-review-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-review">Simulated</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'permission' && provider && (
            <div className="mx-auto max-w-md p-6 sm:p-9">
              <BackButton onClick={() => goToStep('provider')} />
              <StepHeading title={`Connect ${PROVIDER_LABEL[provider]}`} subtitle="Review the demo permission before continuing." />
              <div role="note" className="mt-6 rounded-xl border border-review-line bg-review-soft p-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-review" size={20} aria-hidden />
                  <div>
                    <p className="font-medium text-review">Demo only, no real access</p>
                    <p className="mt-1 text-sm leading-5 text-ink-soft">
                      MailMind will not contact Google or Microsoft, request credentials, or read a real mailbox.
                      Continuing loads invented sample conversations in this browser.
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="primary" className="mt-5 w-full" onClick={() => goToStep('connected')}>
                Simulate permission grant <ArrowRight size={16} aria-hidden />
              </Button>
            </div>
          )}

          {step === 'connected' && provider && (
            <div className="mx-auto max-w-md p-6 text-center sm:p-9">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Check size={26} aria-hidden />
              </span>
              <h1 data-page-title={`${PROVIDER_LABEL[provider]} connected`} className="mt-4 text-2xl font-semibold">{PROVIDER_LABEL[provider]} connected</h1>
              <p className="mt-2 text-sm text-ink-muted">
                This simulated connection is ready. Next, MailMind will load the sample inbox.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-xs text-ink-muted">
                <span className="h-2 w-2 rounded-full bg-ok" /> Simulated connection
              </div>
              <Button variant="primary" className="mt-6 w-full" onClick={() => goToStep('sync')}>
                Sync sample inbox <CloudDownload size={16} aria-hidden />
              </Button>
            </div>
          )}

          {step === 'sync' && (
            <div className="mx-auto max-w-md p-6 text-center sm:p-9">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
                <CloudDownload size={25} aria-hidden />
              </span>
              <h1 data-page-title="Syncing sample inbox" className="mt-4 text-2xl font-semibold">
                {syncPhase === 'syncing' ? 'Syncing sample inbox' : syncPhase === 'complete' ? 'Analysis complete' : `Analyzing ${analysisProgress} of ${syncTotal}`}
              </h1>
              <p className="mt-2 text-sm text-ink-muted">
                {syncPhase === 'syncing'
                  ? 'Loading invented conversations into your demo workspace.'
                  : syncPhase === 'complete'
                    ? 'Your inbox is ready to use.'
                    : 'Analyzing email threads to find responsibility, summaries, actions, and dates.'}
              </p>
              <div className="mt-7" role="progressbar" aria-label="Inbox sync progress" aria-valuemin={0} aria-valuemax={syncTotal} aria-valuenow={currentProgress}>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-150" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="mt-2 text-sm tabular-nums text-ink-muted">
                  {currentProgress} of {syncTotal} {syncPhase === 'syncing' ? 'conversations synced' : 'analyzed'} · {progressPercent}%
                </p>
              </div>
              {analysisNotConfigured && (
                <p className="mt-3 text-xs text-review" role="alert">
                  AI is not configured. Analysis stopped after the first request; your inbox is ready, but AI results are unavailable until the server-side API key is configured.
                </p>
              )}
              {analysisFailures > 0 && (
                <p className="mt-3 text-xs text-review" role="alert">
                  {analysisFailures} thread{analysisFailures === 1 ? '' : 's'} could not be analyzed. The inbox is ready, and failed threads can be retried.
                </p>
              )}
              {syncPhase === 'analyzing' && (
                <Button className="mt-5" onClick={() => {
                  skippedToDashboard.current = true;
                  navigate('/app/dashboard', { replace: true });
                }}>
                  Skip and open dashboard <ArrowRight size={15} aria-hidden />
                </Button>
              )}
              {syncPhase === 'complete' && (
                <Button className="mt-5" onClick={() => navigate('/app/dashboard', { replace: true })}>
                  Open dashboard <ArrowRight size={15} aria-hidden />
                </Button>
              )}
              {syncPhase !== 'complete' && (
                <p className="mt-4 text-xs text-ink-faint">You&apos;ll be taken to your inbox when sync is complete.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-5 inline-flex min-h-11 items-center gap-1 text-sm text-ink-muted hover:text-ink">
      <ChevronLeft size={16} aria-hidden /> Back
    </button>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 data-page-title={title} className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
    </div>
  );
}
