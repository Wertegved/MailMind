import { ResponsibilityPill } from '../../components/email/ResponsibilityPill';
import { Avatar } from '../../components/shared/Avatar';
import { Button } from '../../components/shared/Button';

const SWATCHES = [
  ['Canvas', 'bg-canvas border border-line'], ['Ink', 'bg-ink'], ['Brand / assistant', 'bg-brand'],
  ['Client', 'bg-client'], ['No reply', 'bg-quiet'], ['Needs review', 'bg-review-line'], ['Success', 'bg-ok'],
] as const;

export function DesignPreview() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <header>
        <h1 data-page-title="Design system" className="text-2xl font-semibold">Design system</h1>
        <p className="mt-1 text-sm text-ink-muted">Reference for the tokens and components used across both dashboards. Colour is always paired with an icon and a label.</p>
      </header>

      <section aria-labelledby="ds-colour">
        <h2 id="ds-colour" className="mb-3 text-lg font-semibold">Colour</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, cls]) => (
            <div key={name}><div className={`h-14 rounded-lg ${cls}`} /><p className="mt-1.5 text-xs text-ink-muted">{name}</p></div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ds-pills">
        <h2 id="ds-pills" className="mb-3 text-lg font-semibold">Responsibility labels</h2>
        <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-5">
          <ResponsibilityPill value="assistant_to_reply" />
          <ResponsibilityPill value="client_to_reply" />
          <ResponsibilityPill value="no_reply_needed" />
          <ResponsibilityPill value="assistant_to_reply" overridden />
          <ResponsibilityPill value="unclassified" />
        </div>
        <p className="mt-2 text-sm text-ink-muted">AI confidence and review indicators will appear when analysis is available in Phase 4.</p>
      </section>

      <section aria-labelledby="ds-ui">
        <h2 id="ds-ui" className="mb-3 text-lg font-semibold">Buttons and avatars</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-5">
          <Button variant="primary">Approve and send</Button>
          <Button>Mark handled</Button>
          <Button variant="ghost">Dismiss</Button>
          <Button disabled>Disabled</Button>
          <Avatar name="Maya Lindqvist" /><Avatar name="Harold Whitfield" /><Avatar name="Ledgerly Billing" />
        </div>
      </section>
    </div>
  );
}
