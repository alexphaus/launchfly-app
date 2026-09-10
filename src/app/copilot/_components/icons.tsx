const base = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' };
/** Home: what to do now. */
export const IconNow = () => (<svg {...base}><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>);
/** A line that went up: is it working. */
export const IconWorking = () => (<svg {...base}><path d="M3 17l5-6 4 3.5L21 5" /><path d="M3 21h18" /></svg>);
