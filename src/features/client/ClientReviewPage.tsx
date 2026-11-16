import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MessageThread } from '../../components/email/MessageThread';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMailMind } from '../../state/MailMindProvider';
import { clientQueue, counterpart } from '../../state/selectors';
import { formatFullDateTime, timeAgo } from '../../utils/dates';
import { ClientActions } from './ClientActions';

function summaryFor(conversation: ReturnType<typeof clientQueue>[number]): string {
  const summary = conversation.ai?.summary?.trim();
  if (summary) return summary;
  const latest = conversation.messages[conversation.messages.length - 1];
  const body = latest.body.replace(/\s+/g, ' ').trim();
  return body.length > 160 ? `${body.slice(0, 157).trimEnd()}…` : body;
}

function reasonFor(conversation: ReturnType<typeof clientQueue>[number]): string {
  const reason = conversation.ai?.reason?.trim();
  if (reason) return reason;
  return conversation.override?.by === 'assistant'
    ? 'Your assistant flagged this for you'
    : 'Marked for your attention';
}

export function ClientReviewPage() {
  const { id } = useParams();
  const { state } = useMailMind();
  const conversation = clientQueue(state.conversations).find((item) => item.id === id);

  if (!conversation) {
    return (
      <div className="mx-auto w-full max-w-[42rem] px-4 py-10 sm:px-6">
        <h1 data-page-title="Conversation unavailable" className="sr-only">Conversation unavailable</h1>
        <EmptyState
          title="This conversation isn't in your reply queue"
          body="It may have been handled, handed over, or removed from your queue."
        />
        <div className="mt-4 text-center">
          <Link to="/client" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-client hover:bg-client-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-client focus-visible:outline-offset-2">
            Back to your queue
          </Link>
        </div>
      </div>
    );
  }

  const from = counterpart(conversation);

  return (
    <article className="mx-auto w-full max-w-[42rem] space-y-6 px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <header>
        <Link to="/client" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-client hover:text-client/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-client focus-visible:outline-offset-2">
          <ArrowLeft size={15} aria-hidden /> Back to your queue
        </Link>
        <p className="mt-5 text-sm text-ink-muted">
          <span className="break-words [overflow-wrap:anywhere]">{from.name}</span> · <time dateTime={conversation.lastMessageAt} title={formatFullDateTime(conversation.lastMessageAt)}>{timeAgo(conversation.lastMessageAt)}</time>
        </p>
        <h1 data-page-title={conversation.subject} className="mt-2 break-words text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">{conversation.subject}</h1>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-raised sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{summaryFor(conversation)}</p>
        <div className="mt-5 rounded-xl bg-client-soft px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-client">Why this needs you</h3>
          <p className="mt-1 break-words text-sm leading-6 text-ink-soft">{reasonFor(conversation)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <MessageThread messages={conversation.messages} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Client actions">
        <ClientActions conversation={conversation} returnToQueue />
      </section>
    </article>
  );
}
