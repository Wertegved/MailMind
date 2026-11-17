import { X } from 'lucide-react';

export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm shadow-raised sm:bottom-4">
      <span className="min-w-0 flex-1 break-words text-ink">{message}</span>
      {onUndo && (
        <button type="button" className="min-h-11 shrink-0 font-semibold text-brand hover:text-brand-deep" onClick={onUndo}>
          Undo
        </button>
      )}
      <button type="button" className="min-h-11 min-w-11 shrink-0 text-ink-faint hover:text-ink" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={14} className="mx-auto" aria-hidden />
      </button>
    </div>
  );
}
