import { useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { askAi } from '../../services/ai-client';
import type { Conversation } from '../../types/email';
import { Button } from '../../components/shared/Button';
import { useDialogFocus } from '../../components/shared/useDialogFocus';

export function AskPanel({
  conversations,
  title = 'Ask about this inbox',
  scope = 'inbox',
}: {
  conversations: Conversation[];
  title?: string;
  scope?: 'inbox' | 'conversation';
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const requestInFlightRef = useRef(false);
  const dialogId = useId();
  const suggestions = scope === 'inbox'
    ? [
      'Show me emails that need my attention',
      'What am I waiting for a response on?',
      "Which emails require the client's attention?",
    ]
    : [
      'Summarize this conversation',
      'Why is this assigned this way?',
      'What should I do next?',
    ];

  useDialogFocus(open, dialogRef, questionRef, () => setOpen(false));

  async function askQuestion(questionText: string) {
    if (requestInFlightRef.current || !questionText.trim()) return;
    requestInFlightRef.current = true;
    setQuestion(questionText);
    setLoading(true);
    setError('');
    setAnswer('');
    setConversationIds([]);
    try {
      const result = await askAi(questionText, conversations);
      setAnswer(result.answer);
      setConversationIds(result.conversationIds);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The question could not be answered. Please retry.');
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(question);
  }

  function closePanel() {
    setOpen(false);
  }

  const relevantConversations = conversations.filter((conversation) => conversationIds.includes(conversation.id));

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {scope === 'inbox' ? 'Ask MailMind' : title}
      </Button>
      {open && (
        <section
          id={dialogId}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-heading`}
          tabIndex={-1}
          className="mt-3 rounded-xl border border-line bg-surface p-4 sm:p-5"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 id={`${dialogId}-heading`} className="text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">Ask a question grounded in the email content.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Close ${title}`}
              onClick={closePanel}
            >
              <X size={15} aria-hidden /> Close
            </Button>
          </header>
          <form className="mt-3 space-y-3" onSubmit={submitQuestion}>
            <label className="block">
              <span className="sr-only">Question</span>
              <textarea
                ref={questionRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${dialogId}-error` : undefined}
                maxLength={1_000}
                rows={2}
                placeholder="e.g. Which invoices need follow-up?"
                className="w-full rounded-lg border border-line-strong bg-surface p-3 text-sm outline-none focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
              />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={loading}
                  onClick={() => void askQuestion(suggestion)}
                  className="min-h-11 rounded-full border border-line-strong px-3 py-1.5 text-left text-xs text-ink-soft hover:border-brand hover:bg-brand-soft/30 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={loading || !question.trim() || conversations.length === 0}>
              {loading ? 'Thinking…' : 'Ask'}
            </Button>
          </form>

          {error && <p id={`${dialogId}-error`} className="mt-3 text-sm text-review" role="alert">{error}</p>}
          {loading && <p className="mt-3 text-sm text-ink-muted" role="status">Thinking…</p>}
          {answer && (
            <div className="mt-4 rounded-lg bg-canvas p-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">{answer}</p>
              {relevantConversations.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-line pt-3" aria-label="Related conversations">
                  {relevantConversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        to={`/app/inbox/${conversation.archived ? 'archived' : 'all'}/${conversation.id}`}
                        className="block rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-brand hover:border-brand hover:bg-brand-soft/30 hover:text-brand-deep"
                      >
                        {conversation.subject}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
