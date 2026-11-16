import type { ReactNode } from 'react';

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
