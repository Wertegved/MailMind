import { Link } from 'react-router-dom';
import { RotateCw, Star } from 'lucide-react';
import type { Conversation } from '../../types/email';
import { counterpart, effectiveResponsibility, lastMessage } from '../../state/selectors';
import { formatFullDateTime, timeAgo } from '../../utils/dates';
import { Avatar } from '../shared/Avatar';
import { Skeleton } from '../shared/Skeleton';
import { ResponsibilityPill } from './ResponsibilityPill';

export function ConversationRow({
  c,
  to,
  selected = false,
  onRetryAnalysis,
}: {
  c: Conversation;
  to: string;
  selected?: boolean;
  onRetryAnalysis?: (conversation: Conversation) => void;
}) {
  const from = counterpart(c);
  const snippet = lastMessage(c).body.replace(/\s+/g, ' ').slice(0, 140);

  return (
    <li className="border-b border-line bg-surface">
      <Link to={to} aria-current={selected ? 'page' : undefined} className={`flex gap-3 px-4 py-3.5 transition-colors sm:px-5 ${selected ? 'bg-brand-soft/60' : 'hover:bg-canvas'}`}>
        <div className="relative pt-0.5">
          <Avatar name={from.name} />
          {c.unread && <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" aria-label="Unread" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className={`truncate text-sm ${c.unread ? 'font-semibold' : 'font-medium text-ink-soft'}`}>{from.name}</p>
            <time className="shrink-0 text-xs text-ink-muted" dateTime={c.lastMessageAt} title={formatFullDateTime(c.lastMessageAt)}>
              {timeAgo(c.lastMessageAt)}
            </time>
          </div>
          <p title={c.subject} className={`truncate text-sm ${c.unread ? 'font-medium' : 'text-ink-soft'}`}>
            {c.important && <Star size={13} className="mr-1 inline -translate-y-px fill-review-line text-review-line" aria-label="Important" />}
            {c.subject}
          </p>
          <p className="truncate text-sm text-ink-muted">{snippet}</p>
          <div className="mt-2">
            {c.analysisStatus === 'pending' ? (
              <span role="status" aria-label="Analyzing conversation">
                <Skeleton className="h-6 w-36 rounded-full" />
              </span>
            ) : (
              <ResponsibilityPill
                value={effectiveResponsibility(c)}
                confidence={c.ai?.confidence}
                needsReview={c.reviewState === 'needs_review'}
                overridden={Boolean(c.override)}
              />
            )}
          </div>
          {(c.override?.by === 'client' || (c.completed && c.completedBy === 'client')) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.override?.by === 'client' && (
                <span className="rounded-full bg-client-soft px-2 py-1 text-[11px] font-medium text-client">Handed over by client</span>
              )}
              {c.completed && c.completedBy === 'client' && (
                <span className="rounded-full bg-client-soft px-2 py-1 text-[11px] font-medium text-client">Handled by client</span>
              )}
            </div>
          )}
        </div>
      </Link>
      {c.analysisStatus === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pl-[4.25rem] sm:px-5 sm:pl-[4.75rem]">
          <p className="min-w-0 flex-1 text-xs text-review" role="alert">{c.analysisError || 'Analysis failed.'}</p>
          {onRetryAnalysis && (
            <button
              type="button"
              onClick={() => onRetryAnalysis(c)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:text-brand-deep"
            >
              <RotateCw size={13} aria-hidden /> Retry analysis
            </button>
          )}
        </div>
      )}
    </li>
  );
}
