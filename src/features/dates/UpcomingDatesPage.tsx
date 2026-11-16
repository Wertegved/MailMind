import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/shared/EmptyState';
import { useMailMind } from '../../state/MailMindProvider';
import { upcomingDates } from '../../state/selectors';
import { formatDateTime, formatFullDateTime } from '../../utils/dates';

const KIND_LABEL = {
  meeting: 'Meeting',
  appointment: 'Appointment',
  deadline: 'Deadline',
  other: 'Date',
} as const;

export function UpcomingDatesPage() {
  const { state } = useMailMind();
  const dates = upcomingDates(state.conversations);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-brand">
          <CalendarDays size={18} aria-hidden />
          <p className="text-sm font-medium">Calendar</p>
        </div>
        <h1 data-page-title="Upcoming dates" className="mt-1 text-2xl font-semibold">Upcoming dates</h1>
        <p className="mt-1 text-sm text-ink-muted">Meetings, appointments, and deadlines found in your conversations.</p>
      </header>

      {dates.length === 0 ? (
        <EmptyState title="No upcoming dates yet" body="Dates will appear here when AI analysis is available in Phase 4. No dates are being inferred or invented in this demo." />
      ) : (
        <ol className="overflow-hidden rounded-xl border border-line bg-surface">
          {dates.map((date) => (
            <li key={`${date.conversationId}-${date.date}-${date.label}`} className="border-b border-line last:border-b-0">
              <Link to={`/app/inbox/all/${date.conversationId}`} className="flex flex-wrap items-center gap-4 px-4 py-4 hover:bg-canvas sm:px-5">
                <time dateTime={date.date} title={formatFullDateTime(date.date)} className="w-36 shrink-0 text-sm font-medium text-brand">
                  {formatDateTime(date.date)}
                </time>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{date.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">{date.subject} · {date.senderName}</span>
                </span>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-muted">{KIND_LABEL[date.kind]}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
