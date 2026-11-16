import { useRef } from 'react';
import {
  CircleUser, Clock3, Inbox, ListChecks, Mail, Star, Trash2, UserCog,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { ConversationRow } from '../../components/email/ConversationRow';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Skeleton } from '../../components/shared/Skeleton';
import { useMailMind } from '../../state/MailMindProvider';
import { getStats, isAwaitingOurReply, needsAttention, recentActivity, upcomingDates } from '../../state/selectors';
import { formatDateTime, formatFullDateTime } from '../../utils/dates';
import { PERSONA } from '../../data/sample-conversations';
import { useAnalyzeConversation } from '../ai/useAnalyzeConversation';
import { AskPanel } from '../ai/AskPanel';
import type { AppShellContext } from '../../components/layout/AppShell';

export function Dashboard() {
  const { state, dispatch } = useMailMind();
  const { showToast } = useOutletContext<AppShellContext>();
  const latestState = useRef(state);
  latestState.current = state;
  const analyzeConversation = useAnalyzeConversation();
  const conversations = state.conversations;
  const stats = getStats(conversations);
  const pendingAnalyses = conversations.filter((conversation) => conversation.analysisStatus === 'pending').length;
  const waitingOnReply = conversations.filter((conversation) =>
    !conversation.archived && !conversation.completed && isAwaitingOurReply(conversation),
  ).length;
  const attention = needsAttention(conversations).slice(0, 5);
  const meetings = upcomingDates(conversations)
    .filter((date) => date.kind === 'meeting' || date.kind === 'appointment')
    .slice(0, 5);
  const activity = recentActivity(conversations, 6);

  function clearRecentActivity() {
    if (!window.confirm('Clear all recent activity? You can undo this for a short time.')) return;
    const previousActivity = new Map(conversations.map((conversation) => [conversation.id, conversation.activity]));
    dispatch({ type: 'CLEAR_ACTIVITY' });
    showToast('Recent activity cleared', () => {
      const current = latestState.current;
      if (current.connection.status !== 'connected' || !current.connection.provider || !current.connection.connectedAt) return;
      const restored = current.conversations.map((conversation) => {
        const previous = previousActivity.get(conversation.id);
        if (!previous?.length) return conversation;
        const previousIds = new Set(previous.map((entry) => entry.id));
        return {
          ...conversation,
          activity: [
            ...previous,
            ...conversation.activity.filter((entry) => !previousIds.has(entry.id)),
          ],
        };
      });
      dispatch({
        type: 'CONNECT',
        provider: current.connection.provider,
        conversations: restored,
        now: current.connection.connectedAt,
      });
    });
  }

  const cards = [
    { label: 'Total threads', value: stats.total, aiDerived: false, icon: Inbox, to: '/app/inbox/all' },
    { label: 'Unread', value: stats.unread, aiDerived: false, icon: Mail, to: '/app/inbox/all?unread=1' },
    { label: 'Important', value: stats.important, aiDerived: true, icon: Star, to: '/app/inbox/important' },
    { label: 'Action required', value: stats.actionRequired, aiDerived: true, icon: ListChecks, to: '/app/inbox/action_required' },
    { label: 'Waiting', value: stats.waiting, aiDerived: true, icon: Clock3, to: '/app/inbox/waiting' },
    { label: 'Assistant to reply', value: stats.assistantToReply, aiDerived: true, icon: UserCog, to: '/app/inbox/assistant_to_reply' },
    { label: 'Client to reply', value: stats.clientToReply, aiDerived: true, icon: CircleUser, to: '/app/inbox/client_to_reply' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-8 pt-6 sm:px-6">
      <header>
        <p className="text-sm font-medium text-brand">Assistant dashboard</p>
        <h1 data-page-title="Dashboard" className="mt-1 text-2xl font-semibold">Hello, {PERSONA.assistant.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {waitingOnReply === 0
            ? 'You’re all caught up — no conversations are waiting for your reply.'
            : `${waitingOnReply} ${waitingOnReply === 1 ? 'thread is' : 'threads are'} waiting on a reply.`}
        </p>
      </header>

      <section aria-label="Inbox statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ label, value, aiDerived, icon: Icon, to }) => (
          <Link key={label} to={to} className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand hover:bg-brand-soft/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-muted">{label}</span>
              <Icon size={16} className="shrink-0 text-brand" aria-hidden />
            </div>
            {pendingAnalyses > 0 && aiDerived
              ? <Skeleton className="mt-3 h-7 w-12" />
              : <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>}
          </Link>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="needs-attention" className="overflow-hidden rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 id="needs-attention" className="text-base font-semibold">Needs attention</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Unread, important, or manually assigned threads</p>
            </div>
            <Link to="/app/inbox/all" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand-deep">Open inbox</Link>
          </header>
          {attention.length ? (
            <ul>{attention.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                c={conversation}
                to={`/app/inbox/all/${conversation.id}`}
                onRetryAnalysis={analyzeConversation}
              />
            ))}</ul>
          ) : pendingAnalyses > 0 ? (
            <div className="space-y-4 p-4" role="status" aria-label="Loading conversations that need attention">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-4/5" />
            </div>
          ) : (
            <EmptyState title="All caught up" body="Threads that need your attention will appear here." />
          )}
        </section>

        <section aria-labelledby="upcoming-meetings" className="rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 id="upcoming-meetings" className="text-base font-semibold">Upcoming meetings</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Dates identified in conversation analysis</p>
            </div>
            <Link to="/app/upcoming" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand-deep">All dates</Link>
          </header>
          {meetings.length ? (
            <ul className="divide-y divide-line">
              {meetings.map((meeting) => (
                <li key={`${meeting.conversationId}-${meeting.date}-${meeting.label}`}>
                  <Link to={`/app/inbox/all/${meeting.conversationId}`} className="block px-4 py-3 hover:bg-canvas">
                    <time className="text-xs font-medium text-brand" dateTime={meeting.date} title={formatFullDateTime(meeting.date)}>
                      {formatDateTime(meeting.date)}
                    </time>
                    <p className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">{meeting.label}</p>
                    <p title={`${meeting.subject} · ${meeting.senderName}`} className="mt-0.5 truncate text-xs text-ink-muted">{meeting.subject} · {meeting.senderName}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : pendingAnalyses > 0 ? (
            <div className="space-y-3 p-4" role="status" aria-label="Loading upcoming dates">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-4/5" />
            </div>
          ) : (
            <EmptyState title="No upcoming meetings yet" body="Meeting and appointment dates will appear here when AI analysis is available." />
          )}
        </section>

        <section aria-labelledby="recent-activity" className="rounded-xl border border-line bg-surface lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 id="recent-activity" className="text-base font-semibold">Recent activity</h2>
              <p className="mt-0.5 text-xs text-ink-muted">A timeline of actions across your inbox</p>
            </div>
            {activity.length > 0 && (
              <Button size="md" onClick={clearRecentActivity}>
                <Trash2 size={16} aria-hidden />
                Clear activity
              </Button>
            )}
          </header>
          {activity.length ? (
            <ol className="divide-y divide-line">
              {activity.map(({ conversation, entry }) => (
                <li key={`${conversation.id}-${entry.id}`}>
                  <Link to={`/app/inbox/${conversation.archived ? 'archived' : 'all'}/${conversation.id}`} className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas">
                    <time className="shrink-0 text-xs text-ink-muted" dateTime={entry.at} title={formatFullDateTime(entry.at)}>
                      {formatDateTime(entry.at)}
                    </time>
                    <span className="min-w-0 break-words text-sm text-ink-soft [overflow-wrap:anywhere]"><span className="text-ink-muted">{entry.actor === 'client' ? 'Client' : entry.actor === 'assistant' ? 'Assistant' : entry.actor === 'ai' ? 'AI' : 'System'} · </span>{entry.text}</span>
                    <span title={conversation.subject} className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.subject}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No activity yet" body="Flag changes, handling, overrides, and incoming demo replies will be recorded here." />
          )}
        </section>

        <div className="lg:col-span-2">
          <AskPanel
            conversations={conversations.filter((conversation) => !conversation.archived)}
            title="Ask about this inbox"
            scope="inbox"
          />
        </div>
      </div>
    </div>
  );
}
