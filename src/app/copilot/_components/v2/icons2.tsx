// Line icons for the four-tab shell, drawn on the same 24px grid and stroke as
// icons.tsx so the two sets sit together. Glyphs rather than emoji: an emoji is
// a different picture on every phone, and on some it is a box.
import type { AgentKey } from '@/lib/copilot/machine';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true };

/** Today: the day's one thing. */
export const IconToday = () => (<svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
/** Matches: what was found for you. */
export const IconMatches = () => (<svg {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>);
/** Work: the thing being built. */
export const IconWork = () => (<svg {...base}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
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
