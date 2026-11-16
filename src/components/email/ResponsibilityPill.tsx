import { BellOff, CircleDashed, CircleUser, PenLine, TriangleAlert, UserCog, type LucideIcon } from 'lucide-react';
import type { Effective } from '../../types/email';
import { EFFECTIVE_LABEL } from '../../utils/labels';

const STYLE: Record<Effective, { icon: LucideIcon; cls: string; short: string }> = {
  assistant_to_reply: { icon: UserCog, cls: 'bg-brand-soft text-brand-deep', short: 'Assistant' },
  client_to_reply: { icon: CircleUser, cls: 'bg-client-soft text-client', short: 'Client' },
  no_reply_needed: { icon: BellOff, cls: 'bg-quiet-soft text-quiet', short: 'No reply' },
  unclassified: { icon: CircleDashed, cls: 'bg-canvas text-ink-muted border border-line', short: 'Not analyzed' },
};

interface Props {
  value: Effective;
  confidence?: number;
  /** Low-confidence AI result waiting for a human decision. Visually distinct on purpose. */
  needsReview?: boolean;
  /** A human changed this from the AI suggestion. */
  overridden?: boolean;
}

export function ResponsibilityPill({ value, confidence, needsReview, overridden }: Props) {
  const s = STYLE[value];
  const pct = confidence !== undefined ? Math.round(confidence * 100) : undefined;

  if (needsReview) {
    return (
      <span
        title={`${EFFECTIVE_LABEL[value]}: low confidence, please review`}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-review-line bg-review-soft px-2.5 py-1 text-xs font-medium text-review"
      >
        <TriangleAlert size={13} aria-hidden />
        Review · {s.short}{pct !== undefined && ` ${pct}%`}
      </span>
    );
  }

  const Icon = s.icon;
  return (
    <span
      title={EFFECTIVE_LABEL[value]}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}
    >
      <Icon size={13} aria-hidden />
      {EFFECTIVE_LABEL[value]}
      {pct !== undefined && ` · ${pct}%`}
      {overridden && <PenLine size={11} aria-label="Changed by a person" />}
    </span>
  );
}
