import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-16">
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
        <h1 data-page-title="Page not found" className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-ink-muted">That page may have moved or the address may be incorrect.</p>
        <div className="mt-5">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          >
            Go to MailMind
          </Link>
        </div>
      </div>
    </main>
  );
}
