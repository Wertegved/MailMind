import { useEffect, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, Bell, CheckCircle2, ChevronDown, Mail, RotateCcw, Send, Sparkles, Star,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { ResponsibilityPill } from '../../components/email/ResponsibilityPill';
import { MessageThread } from '../../components/email/MessageThread';
import { Avatar } from '../../components/shared/Avatar';
import { Button } from '../../components/shared/Button';
import { AskPanel } from '../ai/AskPanel';
import { useAnalyzeConversation } from '../ai/useAnalyzeConversation';
import { useDialogFocus } from '../../components/shared/useDialogFocus';
import { draftReply as requestDraftReply } from '../../services/ai-client';
import { useMailMind } from '../../state/MailMindProvider';
import { isStale } from '../../state/selectors';
import { PERSONA } from '../../data/sample-conversations';
import { RESPONSIBILITY_LABEL } from '../../utils/labels';
import { formatDateTime, formatFullDateTime } from '../../utils/dates';
import type { Message, Responsibility } from '../../types/email';
import type { AppShellContext } from '../../components/layout/AppShell';
import type { Conversation } from '../../types/email';

const RESPONSIBILITIES: Responsibility[] = ['assistant_to_reply', 'client_to_reply', 'no_reply_needed'];

export function ConversationDetail({
  conversation,
  backTo,
  markRead,
}: {
  conversation: Conversation;
  backTo: string;
  markRead: boolean;
}) {
  const { state, dispatch } = useMailMind();
  const { showToast } = useOutletContext<AppShellContext>();
  const analyzeConversation = useAnalyzeConversation();
  const openedConversationId = useRef<string | null>(null);
  const insightsTriggerRef = useRef<HTMLButtonElement>(null);
  const insightsCloseRef = useRef<HTMLButtonElement>(null);
  const insightsRef = useRef<HTMLElement>(null);
  const draftInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const [draftBody, setDraftBody] = useState(conversation.draft?.body ?? '');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftError, setDraftError] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const overrideMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => setDraftBody(conversation.draft?.body ?? ''), [conversation.id, conversation.draft?.body]);
  useEffect(() => {
    if (!draftBody.trim()) sendInFlightRef.current = false;
  }, [draftBody]);
  useEffect(() => {
    if (!markRead) {
      openedConversationId.current = null;
      return;
    }
    if (openedConversationId.current === conversation.id) return;
    openedConversationId.current = conversation.id;
    if (conversation.unread) {
      dispatch({
        type: 'SET_FLAG',
        id: conversation.id,
        flag: 'unread',
        value: false,
        by: state.role,
        now: new Date().toISOString(),
      });
    }
  }, [conversation.id, conversation.unread, dispatch, markRead, state.role]);

  useDialogFocus(insightsOpen, insightsRef, insightsCloseRef, () => setInsightsOpen(false));

  function toggleFlag(flag: 'unread' | 'important' | 'archived') {
    const previous = conversation[flag];
    const value = !previous;
    dispatch({ type: 'SET_FLAG', id: conversation.id, flag, value, by: state.role, now: new Date().toISOString() });
    const message = flag === 'unread'
      ? value ? 'Marked conversation unread' : 'Marked conversation as read'
      : flag === 'important'
        ? value ? 'Marked conversation important' : 'Removed important flag'
        : value ? 'Conversation archived' : 'Conversation moved to inbox';
    showToast(message, () => dispatch({
      type: 'SET_FLAG',
      id: conversation.id,
      flag,
      value: previous,
      by: state.role,
      now: new Date().toISOString(),
    }));
  }

  function toggleCompleted() {
    const completed = !conversation.completed;
    dispatch({
      type: 'SET_COMPLETED',
      id: conversation.id,
      completed,
      by: state.role,
      now: new Date().toISOString(),
    });
    showToast(completed ? 'Conversation marked handled' : 'Conversation reopened', () => dispatch({
      type: 'SET_COMPLETED',
      id: conversation.id,
      completed: !completed,
      by: state.role,
      now: new Date().toISOString(),
    }));
  }

  function setResponsibility(value: Responsibility) {
    const previousOverride = conversation.override;
    dispatch({
      type: 'SET_OVERRIDE',
      id: conversation.id,
      value,
      by: state.role,
      now: new Date().toISOString(),
    });
    showToast(`Changed who replies: ${RESPONSIBILITY_LABEL[value]}`, () => {
      if (previousOverride) {
        dispatch({
          type: 'SET_OVERRIDE',
          id: conversation.id,
          value: previousOverride.value,
          by: previousOverride.by,
          note: previousOverride.note,
          now: new Date().toISOString(),
        });
      } else {
        dispatch({ type: 'CLEAR_OVERRIDE', id: conversation.id, by: state.role, now: new Date().toISOString() });
      }
    });
    closeOverrideMenu();
  }

  function closeOverrideMenu() {
    overrideMenuRef.current?.removeAttribute('open');
    overrideMenuRef.current?.querySelector('summary')?.focus();
  }

  async function generateDraft() {
    if (draftInFlightRef.current) return;
    draftInFlightRef.current = true;
    setIsDrafting(true);
    setDraftError('');
    const previousDraft = conversation.draft;
    try {
      const result = await requestDraftReply(conversation, draftInstruction);
      const generatedAt = new Date().toISOString();
      setDraftBody(result.body);
      dispatch({
        type: 'SET_DRAFT',
        id: conversation.id,
        draft: { body: result.body, generatedAt, edited: false },
      });
      showToast('Draft generated', () => {
        setDraftBody(previousDraft?.body ?? '');
        dispatch({ type: 'SET_DRAFT', id: conversation.id, draft: previousDraft });
      });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Draft generation failed. Please retry.');
    } finally {
      draftInFlightRef.current = false;
      setIsDrafting(false);
    }
  }

  function editDraft(body: string) {
    setDraftBody(body);
    dispatch({
      type: 'SET_DRAFT',
      id: conversation.id,
      draft: {
        body,
        generatedAt: conversation.draft?.generatedAt ?? new Date().toISOString(),
        edited: true,
      },
    });
  }

  function approveAndSendDraft() {
    const body = draftBody.trim();
    if (!body || sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    const sender = state.role === 'assistant' ? PERSONA.assistant : PERSONA.client;
    const sentAt = new Date().toISOString();
    const message: Message = {
      id: `${conversation.id}-draft-${Date.now()}`,
      senderName: sender.name,
      senderEmail: sender.email,
      senderRole: state.role,
      direction: 'outbound',
      recipientRole: 'both',
      sentAt,
      body,
    };
    dispatch({ type: 'ADD_MESSAGE', id: conversation.id, message });
    dispatch({ type: 'SET_DRAFT', id: conversation.id, draft: undefined });
    setDraftBody('');
    showToast('Reply sent in the demo. No email was sent.');
  }

  function discardDraft() {
    const previousDraft = conversation.draft;
    dispatch({ type: 'SET_DRAFT', id: conversation.id, draft: undefined });
    setDraftBody('');
    setDraftError('');
    showToast('Draft discarded', () => {
      setDraftBody(previousDraft?.body ?? '');
      dispatch({ type: 'SET_DRAFT', id: conversation.id, draft: previousDraft });
    });
  }

  function acceptSuggestion() {
    dispatch({
      type: 'ACCEPT_SUGGESTION',
      id: conversation.id,
      now: new Date().toISOString(),
    });
    showToast('Accepted the AI suggestion', () => {
      if (conversation.override) {
        dispatch({
          type: 'SET_OVERRIDE',
          id: conversation.id,
          value: conversation.override.value,
          by: conversation.override.by,
          note: conversation.override.note,
          now: new Date().toISOString(),
        });
      }
    });
  }

  function keepOverride() {
    dispatch({
      type: 'KEEP_OVERRIDE',
      id: conversation.id,
      now: new Date().toISOString(),
    });
    showToast('Kept your manual classification');
  }

  const from = conversation.messages.find((message) => message.senderRole === 'external') ?? conversation.messages[0];
  const stale = isStale(conversation);
  const isAnalyzing = conversation.analysisStatus === 'pending';
  const confidencePercent = conversation.ai ? Math.round(conversation.ai.confidence * 100) : null;

  return (
    <article className="min-w-0 rounded-xl border border-line bg-surface pb-20 lg:pb-0">
      <header className="border-b border-line p-4 sm:p-5">
        <Link to={backTo} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep xl:hidden">
          <ArrowLeft size={15} aria-hidden /> Back to list
        </Link>
        <div className="flex items-start gap-3">
          <Avatar name={from.senderName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{from.senderName}</p>
            <p className="truncate text-xs text-ink-muted">{from.senderEmail}</p>
          </div>
          <time className="shrink-0 text-xs text-ink-muted" dateTime={conversation.lastMessageAt} title={formatFullDateTime(conversation.lastMessageAt)}>
            {formatDateTime(conversation.lastMessageAt)}
          </time>
        </div>
        <h2 className="mt-4 break-words text-xl font-semibold [overflow-wrap:anywhere]">{conversation.subject}</h2>
        {conversation.completed && conversation.completedBy === 'client' && (
          <p className="mt-3 rounded-lg bg-client-soft px-3 py-2 text-sm font-medium text-client" role="status">
            Handled by Daniel
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={conversation.important ? 'primary' : 'secondary'}
            aria-label={conversation.important ? 'Remove important flag' : 'Mark important'}
            onClick={() => toggleFlag('important')}
          >
            <Star size={14} fill={conversation.important ? 'currentColor' : 'none'} aria-hidden />
            {conversation.important ? 'Important' : 'Mark important'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toggleFlag('unread')}>
            {conversation.unread ? <Mail size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
            {conversation.unread ? 'Mark read' : 'Mark unread'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toggleFlag('archived')}>
            <Archive size={14} aria-hidden />
            {conversation.archived ? 'Move to inbox' : 'Archive'}
          </Button>
          <Button size="sm" variant={conversation.completed ? 'primary' : 'secondary'} onClick={toggleCompleted}>
            {conversation.completed ? <RotateCcw size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
            {conversation.completed ? 'Reopen' : 'Mark handled'}
          </Button>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <aside
          id="conversation-ai-insights"
          ref={insightsRef}
          className={`order-2 min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${
            insightsOpen
              ? 'fixed inset-x-0 bottom-0 z-40 block max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-raised transition-transform duration-200 motion-reduce:transition-none lg:static lg:max-h-[calc(100vh-2rem)] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
              : 'hidden'
          }`}
          role={insightsOpen ? 'dialog' : undefined}
          aria-modal={insightsOpen ? true : undefined}
          aria-labelledby="conversation-ai-insights-heading"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="conversation-ai-insights-heading" className="text-lg font-semibold">AI insights</h2>
            <Button ref={insightsCloseRef} type="button" className="min-h-11 lg:hidden" aria-label="Close AI insights" onClick={() => setInsightsOpen(false)}>
              Close
            </Button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <ResponsibilityPill
              value={conversation.override?.value ?? conversation.ai?.responsibility ?? 'unclassified'}
              confidence={conversation.ai?.confidence}
              needsReview={conversation.reviewState === 'needs_review'}
              overridden={Boolean(conversation.override)}
            />
            <details
              ref={overrideMenuRef}
              className="relative"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeOverrideMenu();
                }
              }}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line-strong px-3 text-sm font-medium text-ink-soft hover:bg-canvas">
                Change who replies <ChevronDown size={14} className="ml-1 inline" aria-hidden />
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 min-w-56 rounded-xl border border-line bg-surface p-1.5 shadow-raised">
                {RESPONSIBILITIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-canvas"
                    onClick={() => setResponsibility(value)}
                  >
                    {RESPONSIBILITY_LABEL[value]}
                  </button>
                ))}
                {conversation.override && (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-lg border-t border-line px-3 py-2 text-left text-sm text-ink-muted hover:bg-canvas"
                    onClick={() => {
                      const previousOverride = conversation.override;
                      if (!previousOverride) return;
                      dispatch({
                        type: 'CLEAR_OVERRIDE',
                        id: conversation.id,
                        by: state.role,
                        now: new Date().toISOString(),
                      });
                      showToast('Removed the manual classification', () => dispatch({
                        type: 'SET_OVERRIDE',
                        id: conversation.id,
                        value: previousOverride.value,
                        by: previousOverride.by,
                        note: previousOverride.note,
                        now: new Date().toISOString(),
                      }));
                      closeOverrideMenu();
                    }}
                  >
                    Remove manual choice
                  </button>
                )}
              </div>
            </details>
            {conversation.override && (
              <>
                {conversation.override.by === 'client' && (
                  <span className="rounded-full bg-client-soft px-2.5 py-1 text-xs font-medium text-client">Handed over by client</span>
                )}
                <span className="text-xs text-ink-muted">Manual change is sticky until you change or clear it.</span>
              </>
            )}
          </div>
      {conversation.pendingSuggestion && (
        <section className="border-b border-review-line bg-review-soft p-4 sm:p-5" aria-label="Suggested reclassification">
          <p className="text-sm font-semibold text-review">A new analysis suggests {RESPONSIBILITY_LABEL[conversation.pendingSuggestion]}.</p>
          <p className="mt-1 text-sm text-ink-soft">Your manual choice stays active unless you accept this suggestion.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={acceptSuggestion}>Accept suggestion</Button>
            <Button size="sm" variant="secondary" onClick={keepOverride}>Keep mine</Button>
          </div>
        </section>
      )}

      {conversation.analysisStatus === 'error' && (
        <section className="border-b border-line p-4 sm:p-5" role="alert">
          <p className="text-sm text-review">{conversation.analysisError || 'Analysis failed.'}</p>
          <Button size="sm" className="mt-2" onClick={() => analyzeConversation(conversation)} disabled={isAnalyzing}>Retry analysis</Button>
        </section>
      )}

      {conversation.analysisStatus === 'pending' && (
        <p className="border-b border-line px-4 py-3 text-sm text-ink-muted" role="status">Analyzing this conversation…</p>
      )}

      {stale && (
        <p className="flex flex-wrap items-center justify-between gap-2 border-b border-review-line bg-review-soft px-4 py-3 text-sm text-review" role="status">
          <span>A new incoming message needs fresh analysis.</span>
          <Button size="sm" onClick={() => analyzeConversation(conversation)} disabled={isAnalyzing}>Re-run analysis</Button>
        </p>
      )}

      {!conversation.ai && conversation.analysisStatus === 'idle' && (
        <div className="border-b border-line px-4 py-3">
          <p className="mb-3 text-sm text-ink-muted">This conversation hasn&apos;t been analyzed yet. Analyze it to see its summary and suggested responsibility.</p>
          <Button size="sm" onClick={() => analyzeConversation(conversation)} disabled={isAnalyzing}>Analyze with AI</Button>
        </div>
      )}

      {conversation.ai && (
        <section className="space-y-4 border-b border-line p-4 sm:p-5" aria-label="AI analysis">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">AI analysis</h3>
            <Button size="sm" onClick={() => analyzeConversation(conversation)} disabled={isAnalyzing}>Re-run analysis</Button>
          </div>
          {conversation.reclassifiedFrom && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-deep" role="status">
              Reclassified from {RESPONSIBILITY_LABEL[conversation.reclassifiedFrom]} after a new message.
            </p>
          )}
          {confidencePercent !== null && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Confidence</span>
                <span>{confidencePercent}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-canvas"
                role="progressbar"
                aria-label="AI confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={confidencePercent}
              >
                <div
                  className={`h-full rounded-full ${conversation.ai.confidence < 0.75 ? 'bg-review' : 'bg-brand'}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold">Summary</h4>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">{conversation.ai.summary}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Why this classification</h4>
            <p className="mt-1 break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">{conversation.ai.reason}</p>
          </div>
          {conversation.ai.actionItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Action items</h4>
              <ul className="mt-2 space-y-2">
                {conversation.ai.actionItems.map((item) => (
                  <li key={item.id}>
                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => {
                          dispatch({ type: 'TOGGLE_ACTION_ITEM', id: conversation.id, itemId: item.id });
                          showToast(item.done ? 'Action item reopened' : 'Action item completed', () =>
                            dispatch({ type: 'TOGGLE_ACTION_ITEM', id: conversation.id, itemId: item.id }));
                        }}
                        className="mt-0.5 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
                      />
                      <span className={item.done ? 'line-through opacity-60' : ''}>
                        <span className="break-words [overflow-wrap:anywhere]">{item.description}</span>
                        <span className="ml-1 text-xs text-ink-muted">· {item.owner.replace('_', ' ')}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conversation.ai.importantDates.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Dates found in this thread</h4>
              <ul className="mt-2 space-y-1">
                {conversation.ai.importantDates.map((date, index) => (
                  <li key={`${date.date}-${index}`} className="text-sm text-ink-soft">
                    <span className="font-medium">{date.label}</span>
                    <span className="text-ink-muted"> · {formatDateTime(date.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conversation.reviewState === 'needs_review' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-review-soft p-3">
              <p className="text-sm text-review">
                {Math.round(conversation.ai.confidence * 100)}% confidence · Please review this suggestion.
              </p>
              <Button size="sm" onClick={() => {
                dispatch({
                  type: 'CONFIRM_REVIEW',
                  id: conversation.id,
                  now: new Date().toISOString(),
                });
                showToast('AI classification confirmed');
              }}>
                Looks right
              </Button>
            </div>
          )}
        </section>
      )}

      <div className="border-t border-line p-4 sm:p-5">
        <AskPanel conversations={[conversation]} title="Ask about this conversation" scope="conversation" />
      </div>

      <section aria-labelledby="activity-heading" className="border-t border-line bg-canvas/60 p-4 sm:p-5">
        <h3 id="activity-heading" className="text-sm font-semibold">Activity</h3>
        {conversation.activity.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Actions on this conversation will appear here.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {[...conversation.activity].reverse().map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <span className="min-w-0 flex-1 text-ink-soft"><span className="capitalize text-ink-muted">{entry.actor} · </span>{entry.text}</span>
                <time className="shrink-0 text-xs text-ink-muted" dateTime={entry.at} title={formatFullDateTime(entry.at)}>
                  {formatDateTime(entry.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
        </aside>

        <div className="order-1 min-w-0">
      <section className="p-4 sm:p-5">
        <MessageThread messages={conversation.messages} />
      </section>

      <section className="space-y-3 border-t border-line p-4 sm:p-5" aria-label="Reply draft">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand" aria-hidden />
          <h3 className="text-sm font-semibold">Reply draft</h3>
        </div>
        <p className="text-xs text-ink-muted">Drafts are never sent automatically. Approving sends only a simulated reply in this demo.</p>
        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Instruction for this draft (optional)</span>
          <input
            value={draftInstruction}
            onChange={(event) => setDraftInstruction(event.target.value)}
            maxLength={1_000}
            placeholder="e.g. Keep it brief and suggest Friday"
            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          />
        </label>
        {!(draftError && !draftBody) && (
          <label className="block">
            <span className="sr-only">Draft reply body</span>
            <textarea
              id="draft-body"
              value={draftBody}
              onChange={(event) => editDraft(event.target.value)}
              aria-invalid={Boolean(draftError)}
              aria-describedby={draftError ? 'draft-error' : undefined}
              rows={5}
              maxLength={12_000}
              placeholder="Generate a draft or write your own…"
              className="w-full rounded-lg border border-line-strong bg-surface p-3 text-sm leading-6 outline-none focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
            />
          </label>
        )}
        {draftError && <p id="draft-error" className="text-sm text-review" role="alert">{draftError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void generateDraft()} disabled={isDrafting}>
            <Sparkles size={14} aria-hidden /> {isDrafting ? 'Generating…' : draftError ? 'Retry draft' : conversation.draft ? 'Regenerate draft' : 'Generate draft'}
          </Button>
          {(conversation.draft || draftBody.trim()) && (
            <Button size="sm" variant="secondary" onClick={discardDraft}>
              Discard
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={approveAndSendDraft} disabled={!draftBody.trim()}>
            <Send size={14} aria-hidden /> Approve &amp; send
          </Button>
        </div>
      </section>

        </div>
      </div>

      {insightsOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label="Close AI insights"
          onClick={() => {
            setInsightsOpen(false);
          }}
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <Button
          ref={insightsTriggerRef}
          type="button"
          variant="primary"
          className="min-h-11 w-full"
          aria-controls="conversation-ai-insights"
          aria-expanded={insightsOpen}
          aria-label={conversation.reviewState === 'needs_review' ? 'AI insights, needs review' : 'AI insights'}
          onClick={() => setInsightsOpen(true)}
        >
          AI insights
          {conversation.reviewState === 'needs_review' && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-review-line" />}
        </Button>
      </div>
    </article>
  );
}
