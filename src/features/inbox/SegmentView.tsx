import { useEffect, useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ConversationRow } from '../../components/email/ConversationRow';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/shared/Button';
import { ConversationDetail } from './ConversationDetail';
import { useMailMind } from '../../state/MailMindProvider';
import { byRecent, isSegmentId, matchesSegment, SEGMENTS } from '../../state/selectors';
import { useAnalyzeConversation } from '../ai/useAnalyzeConversation';

const QUICK_FILTERS = [
  { id: 'unread', label: 'Unread' },
  { id: 'important', label: 'Important' },
  { id: 'needs_review', label: 'Needs review' },
] as const;

type QuickFilter = (typeof QUICK_FILTERS)[number]['id'];

export function SegmentView() {
  const { segment, conversationId } = useParams();
  const { state } = useMailMind();
  const analyzeConversation = useAnalyzeConversation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const activeFilters = useMemo(
    () => new Set(QUICK_FILTERS
      .filter(({ id }) => searchParams.get(id) === '1')
      .map(({ id }) => id)),
    [searchParams],
  );
  const segmentId = isSegmentId(segment) ? segment : undefined;

  const rows = useMemo(() => {
    if (!segmentId) return [];
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return state.conversations
      .filter((conversation) => {
        if (!matchesSegment(conversation, segmentId)) return false;
        if (words.length > 0) {
          const text = [
            conversation.subject,
            ...conversation.messages.flatMap((message) => [message.senderName, message.senderEmail, message.body]),
            conversation.ai?.summary ?? '',
          ].join(' ').toLocaleLowerCase();
          if (!words.every((word) => text.includes(word))) return false;
        }

        return [...activeFilters].every((filter) => {
          switch (filter) {
            case 'unread': return conversation.unread;
            case 'important': return conversation.important || Boolean(conversation.ai?.tags.includes('important'));
            case 'needs_review': return conversation.reviewState === 'needs_review';
          }
        });
      })
      .sort(byRecent);
  }, [activeFilters, search, state.conversations, segmentId]);

  useEffect(() => {
    if (!segmentId || !conversationId) return;
    if (state.conversations.some((conversation) => conversation.id === conversationId) &&
      !rows.some((conversation) => conversation.id === conversationId)) {
      const nextPath = rows[0]
        ? `/app/inbox/${segmentId}/${rows[0].id}${location.search}`
        : `/app/inbox/${segmentId}${location.search}`;
      navigate(nextPath, { replace: true });
    }
  }, [conversationId, location.search, navigate, rows, segmentId, state.conversations]);

  function updateSearchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function toggleFilter(filter: QuickFilter) {
    updateSearchParam(filter, activeFilters.has(filter) ? '' : '1');
  }

  function clearSearchAndFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  if (!segmentId) return <Navigate to="/app/inbox/all" replace />;

  const title = SEGMENTS.find((item) => item.id === segmentId)!.label;
  const missingConversation = Boolean(conversationId) &&
    !state.conversations.some((conversation) => conversation.id === conversationId);
  const selected = rows.find((conversation) => conversation.id === conversationId) ??
    (!conversationId ? rows[0] : undefined);

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-6 sm:px-5">
      <header className="pb-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 data-page-title={conversationId && selected ? selected.subject : `Inbox · ${title}`} className="break-words text-2xl font-semibold [overflow-wrap:anywhere]">
              {conversationId && selected ? selected.subject : title}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              <span className="tabular-nums">{rows.length}</span> {rows.length === 1 ? 'conversation' : 'conversations'}
              {search || activeFilters.size ? ' match your search and filters' : ''}
            </p>
          </div>
          <Link to="/app/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand-deep">Dashboard</Link>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={search}
              onChange={(event) => updateSearchParam('q', event.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-sm outline-none focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded p-1 text-ink-muted hover:bg-canvas"
                onClick={() => updateSearchParam('q', '')}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Quick filters">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={activeFilters.has(filter.id)}
                onClick={() => toggleFilter(filter.id)}
                className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                  activeFilters.has(filter.id)
                    ? 'border-brand bg-brand-soft text-brand-deep'
                    : 'border-line bg-surface text-ink-muted hover:bg-canvas'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {missingConversation ? (
        <EmptyState
          title="This conversation no longer exists"
          body="It may have been removed or reset from the demo."
          action={
            <Link
              to={`/app/inbox/${segmentId}${location.search}`}
              className="inline-flex min-h-11 items-center rounded-lg px-4 font-medium text-brand hover:bg-brand-soft"
            >
              Back to conversation list
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={search || activeFilters.size
            ? segmentId === 'archived' ? 'No matching archived conversations' : 'No matching conversations'
            : segmentId === 'archived' ? 'No archived conversations' : 'No conversations in this segment'}
          body={search || activeFilters.size
            ? 'Try another search or clear the search and quick filters.'
            : segmentId === 'archived' ? 'Conversations you archive will appear here.' : 'Conversations that match this segment will appear here.'}
          action={search || activeFilters.size
            ? <Button type="button" onClick={clearSearchAndFilters}>Clear search and filters</Button>
            : undefined}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
          <ul className={`${conversationId ? 'hidden xl:block' : 'block'} overflow-hidden rounded-xl border border-line bg-surface xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto`}>
            {rows.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                c={conversation}
                to={`/app/inbox/${segmentId}/${conversation.id}${location.search}`}
                selected={conversation.id === selected?.id}
                onRetryAnalysis={analyzeConversation}
              />
            ))}
          </ul>
          {selected && (
            <div className={`${conversationId ? 'block' : 'hidden xl:block'} xl:sticky xl:top-4 xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto`}>
              <ConversationDetail
                key={selected.id}
                conversation={selected}
                backTo={`/app/inbox/${segmentId}${location.search}`}
                markRead={Boolean(conversationId)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
