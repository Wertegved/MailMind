import { Link } from 'react-router-dom';
import { Avatar } from '../../components/shared/Avatar';
import { useMailMind } from '../../state/MailMindProvider';
import { clientQueue, counterpart, lastMessage } from '../../state/selectors';
import { formatFullDateTime, timeAgo } from '../../utils/dates';
import { PERSONA } from '../../data/sample-conversations';
import { ClientActions } from './ClientActions';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function summaryFor(conversation: ReturnType<typeof clientQueue>[number]): string {
  const summary = conversation.ai?.summary?.trim();
  if (summary) return summary;
  const body = lastMessage(conversation).body.replace(/\s+/g, ' ').trim();
  return body.length > 160 ? `${body.slice(0, 157).trimEnd()}…` : body;
}

function reasonFor(conversation: ReturnType<typeof clientQueue>[number]): string {
  const reason = conversation.ai?.reason?.trim();
  if (reason) return reason;
  return conversation.override?.by === 'assistant'
    ? 'Your assistant flagged this for you'
    : 'Marked for your attention';
}

export function ClientQueuePage() {
  const { state } = useMailMind();
  const queue = clientQueue(state.conversations);

  return (
    <div className="mx-auto w-full max-w-[42rem] space-y-6 px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <header>
        <p className="text-sm font-medium text-client">Your personal reply queue</p>
        <h1 data-page-title="Client queue" className="mt-2 text-3xl font-semibold">{greeting(new Date().getHours())}, {PERSONA.client.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="tabular-nums">{queue.length}</span> {queue.length === 1 ? 'thing needs you' : 'things need you'}
        </p>
      </header>

      {queue.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-8 text-center sm:p-10">
          <h2 className="text-xl font-semibold">You&apos;re all caught up</h2>
          <p className="mt-2 text-sm text-ink-muted">There are no conversations waiting for your personal reply.</p>
        </section>
      ) : (
        <ul className="space-y-4">
          {queue.map((conversation) => {
            const from = counterpart(conversation);
            return (
              <li key={conversation.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-raised sm:p-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={from.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{from.name}</p>
                    <time className="text-xs text-ink-muted" dateTime={conversation.lastMessageAt} title={formatFullDateTime(conversation.lastMessageAt)}>
                      Received {timeAgo(conversation.lastMessageAt)}
                    </time>
                  </div>
                </div>
                <h2 title={conversation.subject} className="mt-4 break-words text-lg font-semibold [overflow-wrap:anywhere]">{conversation.subject}</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{summaryFor(conversation)}</p>
                <div className="mt-4 rounded-xl bg-client-soft px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-client">Why this needs you</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-ink-soft">{reasonFor(conversation)}</p>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Link
                    to={`/client/${conversation.id}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-client px-4 text-sm font-medium text-white hover:bg-client/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-client focus-visible:outline-offset-2 sm:w-auto"
                  >
                    Review conversation
                  </Link>
                </div>
                <div className="mt-2">
                  <ClientActions conversation={conversation} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
