// src/lib/copilot/sensors.ts
// Records: what the app reads instead of asking.
//
// DIRECTION.md put the root cause of "it only ever advises outreach" in one
// sentence: everything observed is outbound supply, so the engine has one
// lever. Each sensor below is another thing observed — money in and out,
// money owed, hours worked, what the watched sources post — and every one of
// them is rows a general agent with a memory file never collected.
//
// They lived in four places: a finance sheet, a money sheet, a tile on You and
// a line under Settings. This is the one list, so the question "what does it
// actually know about me, and how" has one answer on screen — and so a new
// sensor is one entry here, its status line below, and its sheet.
//
// Adding one (a calendar, a CV, a bank link):
//   1. A SensorDef in SENSORS, with how it records and the sheet that opens it.
//   2. Its line in sensorViews, computed from rows — never a promise.
//   3. The sheet. Nothing is listed before its sheet exists: a row that opens
//      nothing is a capability with no route behind it (invariant 7), and a
//      test reads SheetContent for every `sheet` named here.
//
// Pure: no DB import. The shells pass what loadHome already read.

import { hoursLabel } from './focus';
import { dayLabel } from './money/ledger';

export type SensorKey = 'bank' | 'owed' | 'focus' | 'feeds';
/** How a record arrives: a file the person uploads, a line they type, something read on its own, or a linked account. */
export type SensorHow = 'upload' | 'typed' | 'automatic' | 'link';
/** The sheet that opens each one. Every value must be a SheetState kind the shells render. */
export type SensorSheet = 'bank' | 'money' | 'focus' | 'watchlist';

export interface SensorDef {
  key: SensorKey;
  label: string;
  /** What it records, in a phrase. */
  records: string;
  how: SensorHow;
  sheet: SensorSheet;
}

export const SENSORS: readonly SensorDef[] = [
  { key: 'bank', label: 'Bank statements', records: 'Money in and out, read off your bank’s own file', how: 'upload', sheet: 'bank' },
  { key: 'owed', label: 'Money owed', records: 'Invoices and bills with a date, either way', how: 'typed', sheet: 'money' },
  { key: 'focus', label: 'Deep work', records: 'Hours on the thing that moves a goal', how: 'typed', sheet: 'focus' },
  // Not "every night": that is true only while the nightly job actually runs, and the Nightly run row is where that is said.
  { key: 'feeds', label: 'Sources you watch', records: 'Posts and listings it reads for you', how: 'automatic', sheet: 'watchlist' },
];

export const HOW_LABEL: Record<SensorHow, string> = {
  upload: 'You upload',
  typed: 'You log',
  automatic: 'Read on its own',
  link: 'Linked',
};

/** on: recording. off: nothing yet. attention: something is waiting on the person or broke. */
export type SensorState = 'on' | 'off' | 'attention';

export interface SensorView extends SensorDef {
  state: SensorState;
  /** Where it stands, from rows: "412 transactions · to 30 Sep", "2 of 5 failing". */
  line: string;
}

export interface SensorInput {
  bank: {
    ready: boolean;
    rows: number;
    /** The last day the rows cover. */
    to: string | null;
    reading: number;
    review: number;
    failed: number;
    unreadable: string | null;
  } | null;
  owed: { open: number };
  focus: { minutesWeek: number };
  feeds: { total: number; failing: number };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function sensorViews(input: SensorInput): SensorView[] {
  return SENSORS.map((def): SensorView => {
    switch (def.key) {
      case 'bank': {
        const b = input.bank;
        // Not set up on this server is a state, said as one — it is not "nothing uploaded".
        if (!b || !b.ready) return { ...def, state: 'off', line: 'Not set up on this server yet' };
        if (b.unreadable) return { ...def, state: 'attention', line: `Could not read your statements: ${b.unreadable}` };
        if (b.review) return { ...def, state: 'attention', line: `${plural(b.review, 'statement')} waiting on you to check` };
        if (b.reading) return { ...def, state: 'on', line: `Reading ${plural(b.reading, 'statement')}…` };
        if (!b.rows) return { ...def, state: b.failed ? 'attention' : 'off', line: b.failed ? `The last upload could not be read` : 'Upload a statement: CSV, OFX, PDF or a screenshot' };
        return { ...def, state: 'on', line: `${plural(b.rows, 'transaction')}${b.to ? ` · to ${dayLabel(b.to)}` : ''}` };
      }
      case 'owed':
        return input.owed.open
          ? { ...def, state: 'on', line: `${input.owed.open} open` }
          : { ...def, state: 'off', line: 'Nothing logged' };
      case 'focus':
        return input.focus.minutesWeek
          ? { ...def, state: 'on', line: `${hoursLabel(input.focus.minutesWeek)} this week` }
          : { ...def, state: 'off', line: 'Nothing logged this week' };
      case 'feeds': {
        const f = input.feeds;
        if (!f.total) return { ...def, state: 'off', line: 'None yet' };
        return f.failing
          ? { ...def, state: 'attention', line: `${f.failing} of ${f.total} failing` }
          : { ...def, state: 'on', line: `${f.total} watched` };
      }
    }
  });
}
