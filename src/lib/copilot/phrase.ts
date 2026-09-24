// src/lib/copilot/phrase.ts
// Job keys, in the words a person would use for them.
//
// A job key is this codebase's word for a sensor — `send_queue`, `runway_guard`
// — and printing one is the database talking. The handoff export already knew
// that; the screen did not, and "3 of your last 10 calls were about send_queue"
// shipped on the Working tab. The table lived in call.ts, which imports the
// store, so nothing rendered in a browser could reach it. It lives here now,
// with no imports at all, and call.ts re-exports it for the routes that already
// read it from there.

export const JOB_PHRASE: Record<string, string> = {
  send_queue: 'sending the drafts',
  client_delivery: 'chasing delivery',
  repeat_customer: 'reconnecting with past customers',
  runway_guard: 'the runway question',
  goal_gap: 'the goal you set',
  opening_gap: 'changing the offer',
  capability_gap: 'the thing to get better at',
  watch: 'what your feeds turned up',
  silence: 'reading the openers that got no reply',
  propose: 'work it offers to take off you',
  commission: 'the jobs you handed over',
};

export const phraseFor = (job: string) => JOB_PHRASE[job] ?? job.replace(/_/g, ' ');
