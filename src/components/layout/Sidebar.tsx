import {
  Archive, BellOff, CalendarDays, CircleUser, Hourglass, Inbox, Layers, LayoutDashboard, ListChecks, Palette, Settings, Star, UserCog, type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { SEGMENTS, segmentCount, type SegmentId } from '../../state/selectors';
import { PERSONA } from '../../data/sample-conversations';
import { useMailMind } from '../../state/MailMindProvider';
import { Logo } from '../shared/Logo';

const ICON: Record<SegmentId, LucideIcon> = {
  all: Inbox, assistant_to_reply: UserCog, client_to_reply: CircleUser, no_reply_needed: BellOff,
  action_required: ListChecks, waiting: Hourglass, meetings: CalendarDays, important: Star, general: Layers, archived: Archive,
};

const GROUPS: { title?: string; ids: SegmentId[] }[] = [
  { ids: ['all'] },
  { title: 'Who replies', ids: ['assistant_to_reply', 'client_to_reply', 'no_reply_needed'] },
  { title: 'Status', ids: ['action_required', 'waiting', 'meetings', 'important', 'general'] },
  { ids: ['archived'] },
];

const label = (id: SegmentId) => SEGMENTS.find((s) => s.id === id)!.label;

export function Sidebar() {
  const { state } = useMailMind();
  const location = useLocation();
  const connected = state.connection.status === 'connected';

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo />
        <div className="leading-tight">
          <p className="font-display text-lg font-semibold">MailMind</p>
          <p className="text-xs text-ink-muted">Your inbox, intelligently managed.</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Inbox segments">
        <NavLink
          to="/app/dashboard"
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-canvas'
            }`
          }
        >
          <LayoutDashboard size={16} aria-hidden /> <span className="flex-1">Dashboard</span>
        </NavLink>
        {GROUPS.map((g, i) => (
          <div key={i} className="mt-4 first:mt-1">
            {g.title && <p className="px-2 pb-1 text-xs font-medium text-ink-faint">{g.title}</p>}
            {g.ids.map((id) => {
              const Icon = ICON[id];
              const n = connected ? segmentCount(state.conversations, id) : 0;
              return (
                <NavLink
                  key={id}
                  to={`/app/inbox/${id}${location.search}`}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      isActive ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-canvas'
                    }`
                  }
                >
                  <Icon size={16} aria-hidden />
                  <span className="flex-1 truncate">{label(id)}</span>
                  {connected && <span className="text-xs tabular-nums text-ink-muted">{n}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
        <NavLink
          to="/app/upcoming"
          className={({ isActive }) =>
            `mt-4 flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-canvas'
            }`
          }
        >
          <CalendarDays size={16} aria-hidden /> Upcoming dates
        </NavLink>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-canvas'
            }`
          }
        >
          <Settings size={16} aria-hidden /> Settings
        </NavLink>
        <NavLink to="/app/design" className="mt-6 flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted hover:bg-canvas">
          <Palette size={16} aria-hidden /> Design system
        </NavLink>
      </nav>

      <div className="border-t border-line px-5 py-4 text-sm">
        <p className="font-medium">{PERSONA.assistant.name}</p>
        <p className="text-xs text-ink-muted">Assistant to {PERSONA.client.name}</p>
      </div>
    </aside>
  );
}

/** Mobile: the same segments as a horizontally scrolling chip row. */
export function MobileSegments() {
  const { state } = useMailMind();
  const location = useLocation();
  const connected = state.connection.status === 'connected';
  return (
    <nav className="flex min-w-0 max-w-full touch-pan-x gap-2 overflow-x-auto overscroll-x-contain border-b border-line bg-surface px-4 py-2 md:hidden" aria-label="Inbox segments">
      <NavLink to="/app/dashboard" className={({ isActive }) => `flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm ${isActive ? 'bg-brand text-white' : 'bg-canvas text-ink-soft'}`}>
        Dashboard
      </NavLink>
      <NavLink to="/app/upcoming" className={({ isActive }) => `flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm ${isActive ? 'bg-brand text-white' : 'bg-canvas text-ink-soft'}`}>
        Upcoming
      </NavLink>
      <NavLink to="/app/settings" className={({ isActive }) => `flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm ${isActive ? 'bg-brand text-white' : 'bg-canvas text-ink-soft'}`}>
        Settings
      </NavLink>
      {SEGMENTS.map((s) => (
        <NavLink
          key={s.id}
          to={`/app/inbox/${s.id}${location.search}`}
          className={({ isActive }) =>
            `flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm ${isActive ? 'bg-brand text-white' : 'bg-canvas text-ink-soft'}`
          }
        >
          {s.label}
          {connected && <span className="ml-1.5 text-xs tabular-nums opacity-70">{segmentCount(state.conversations, s.id)}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
