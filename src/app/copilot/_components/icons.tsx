const base = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' };
export const IconToday = () => (<svg {...base}><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>);
/** Three bars, narrowing: a funnel seen from the side. */
export const IconPipeline = () => (<svg {...base}><path d="M3 6h18" /><path d="M6 12h12" /><path d="M9 18h6" /></svg>);
/** A pulse: what the market keeps asking for. */
export const IconSignals = () => (<svg {...base}><path d="M2 12h4l3-7 4 14 3-7h6" /></svg>);
