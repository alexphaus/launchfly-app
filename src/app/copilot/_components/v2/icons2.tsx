// Line icons for the four-tab shell, drawn on the same 24px grid and stroke as
// icons.tsx so the two sets sit together. Glyphs rather than emoji: an emoji is
// a different picture on every phone, and on some it is a box.
import type { AgentKey } from '@/lib/copilot/machine';
import type { MatchGroup } from '@/lib/copilot/matches';
import type { PathIcon } from '@/lib/copilot/pathway';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true };

/** Today: the day's one thing. */
export const IconToday = () => (<svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
/** Matches: what was found for you. */
export const IconMatches = () => (<svg {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>);
/** Work: the thing being built. */
export const IconWork = () => (<svg {...base}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
/** Path: from where you were to where you are going — two points and the way between. */
export const IconPath = () => (<svg {...base}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16" /></svg>);
/** The goal at the end of the path. */
export const IconFlag = () => (<svg {...base}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>);
/** You: the person the numbers are about. */
export const IconYou = () => (<svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);

export const IconChevron = () => (<svg {...base} className="cp2-chev"><path d="M9 6l6 6-6 6" /></svg>);
export const IconCheck = () => (<svg {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconAlert = () => (<svg {...base}><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>);
export const IconExternal = () => (<svg {...base} className="cp2-ext"><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);

/** One glyph per agent, so the roster reads as a team at a glance. */
export function AgentGlyph({ agent }: { agent: AgentKey }) {
  switch (agent) {
    // A lens: it goes and looks.
    case 'scout': return (<svg {...base}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg>);
    // Waves: it listens to what is broadcast.
    case 'watcher': return (<svg {...base}><circle cx="6" cy="18" r="1.5" /><path d="M4.5 11a8.5 8.5 0 0 1 8.5 8.5M4.5 5a14.5 14.5 0 0 1 14.5 14.5" /></svg>);
    // A nib: it writes in your words.
    case 'writer': return (<svg {...base}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /><path d="M14 7l3 3" /></svg>);
    // A flask: it goes away and works something out.
    case 'researcher': return (<svg {...base}><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7 15h10" /></svg>);
    // A compass: it picks the direction.
    case 'planner': return (<svg {...base}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></svg>);
  }
}

/**
 * The tile on a match with no photo and no initials worth showing — a find from
 * a feed, whose title is a sentence. What kind of thing it is, as a picture.
 */
export function MatchGlyph({ group }: { group: MatchGroup }) {
  switch (group) {
    // A shopfront: a business you would pitch.
    case 'clients': return (<svg {...base}><path d="M4 10v10h16V10" /><path d="M3 10l2-6h14l2 6H3z" /><path d="M10 20v-5h4v5" /></svg>);
    // A case: somebody paying for work.
    case 'work': return (<svg {...base}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></svg>);
    // A person worth meeting.
    case 'people': return (<svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
    // A spark: something changing.
    case 'signals': return (<svg {...base}><path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z" /></svg>);
  }
}

/**
 * One glyph per kind of thing that moved, so the stream reads at a glance: who
 * looked, who wrote, who sent, who answered. The agents keep their roster glyph
 * — the Scout's lens on Path is the Scout on You.
 */
export function PathGlyph({ icon }: { icon: PathIcon }) {
  switch (icon) {
    case 'scout': return <AgentGlyph agent="scout" />;
    case 'watcher': return <AgentGlyph agent="watcher" />;
    case 'writer': return <AgentGlyph agent="writer" />;
    case 'research': return <AgentGlyph agent="researcher" />;
    case 'call': return <AgentGlyph agent="planner" />;
    // A paper plane: it went out, from you.
    case 'send': return (<svg {...base}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>);
    // A speech bubble: somebody answered.
    case 'reply': return (<svg {...base}><path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5Z" /></svg>);
    // A calendar: a meeting or a proposal on the table.
    case 'meeting': return (<svg {...base}><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></svg>);
    // A note: money in.
    case 'money': return (<svg {...base}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>);
    // A closed circle: a no.
    case 'lost': return (<svg {...base}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>);
    // A clock: hours you put in.
    case 'focus': return (<svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case 'done': return <IconCheck />;
  }
}
