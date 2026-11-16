import { useEffect, useState } from 'react';
import type { Message } from '../../types/email';
import { formatFullDateTime, timeAgo } from '../../utils/dates';
import { Button } from '../shared/Button';

export function MessageThread({ messages }: { messages: Message[] }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const earlierCount = Math.max(0, messages.length - 2);

  useEffect(() => setShowEarlier(false), [messages]);

  const visibleMessages = showEarlier || earlierCount === 0
    ? messages
    : messages.slice(-2);

  return (
    <section aria-labelledby="conversation-thread-heading">
      <h2 id="conversation-thread-heading" className="text-lg font-semibold">Conversation</h2>
      {earlierCount > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-3 min-h-11"
          aria-expanded={showEarlier}
          onClick={() => setShowEarlier((shown) => !shown)}
        >
          {showEarlier ? 'Hide earlier messages' : `Show ${earlierCount} earlier ${earlierCount === 1 ? 'message' : 'messages'}`}
        </Button>
      )}
      <ol className="mt-4 space-y-4">
        {visibleMessages.map((message) => {
          const ownRole = message.senderRole === 'assistant' || message.senderRole === 'client'
            ? message.senderRole
            : undefined;
          const roleLabel = ownRole === 'assistant' ? 'Assistant' : ownRole === 'client' ? 'Client' : undefined;

          return (
            <li key={message.id} className={`flex min-w-0 ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <article
                className={`min-w-0 max-w-full rounded-xl border px-4 py-3 sm:max-w-[85%] ${
                  message.direction === 'outbound'
                    ? ownRole === 'client' ? 'border-client/20 bg-client-soft' : 'border-brand/20 bg-brand-soft'
                    : 'border-transparent bg-canvas'
                }`}
              >
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{message.senderName}</p>
                  {roleLabel && (
                    <span className="rounded-full bg-surface/80 px-2 py-0.5 text-xs font-medium text-ink-soft">
                      {roleLabel}
                    </span>
                  )}
                  <time
                    className="shrink-0 text-xs text-ink-muted"
                    dateTime={message.sentAt}
                    title={formatFullDateTime(message.sentAt)}
                  >
                    {timeAgo(message.sentAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">{message.body}</p>
                <p className="mt-2 break-words text-xs text-ink-muted [overflow-wrap:anywhere]">{message.senderEmail}</p>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
