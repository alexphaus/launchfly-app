'use client';
// What the mic opens when what was said was not money (lib/copilot/tell.ts):
// the line that says what was heard and who sorted it, on every sheet the mic
// fills in; the chooser, for what could not be told or was told wrong; and the
// note for the plan, kept in the words that were said.
//
// The conversation, sale, meeting and offer sheets are the ones those records
// always had (LabSheets, ProofSheets, SheetContent), taking the sort as their
// first values. Nothing is kept until the person keeps it there.
import { useState } from 'react';
import { NOTE_MAX, TOLD_LABEL, toldAs, type Reading, type ToldKind, type ToldMeta } from '@/lib/copilot/tell';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions, SheetState } from '../shared';
import { IconMic } from './icons2';

/**
 * The sheet a sort opens. Money is the book's own sheet, which the shell
 * holds; everything else is a sheet of the app's. `swap` replaces the sheet on
 * top — a sort corrected on the chooser is the same step, not another to go
 * back through.
 */
export function openReading(r: Reading, o: { actions: Actions; openMoney: (heard: string) => void; swap?: boolean }): void {
  const { meta, told } = r;
  const open = (s: SheetState) => (o.swap ? o.actions.swapSheet(s) : o.actions.openSheet(s));
  if (!told) return open({ kind: 'told', meta });
  switch (told.kind) {
    case 'money': return o.openMoney(meta.heard);
    case 'question': return open({ kind: 'ask', heard: meta.heard });
    case 'talk': return open({ kind: 'talk', told: { meta, talk: told.talk } });
    case 'sale':
    case 'meeting': return open({ kind: 'sale', outcome: told.kind === 'sale' ? 'won' : 'meeting', told: { meta, sale: told.sale } });
    case 'offer': return open({ kind: 'offer', told: { meta, offer: told.offer } });
    case 'note': return open({ kind: 'note', told: { meta, content: told.note.content } });
  }
}

/** Who sorted it, said once: a model's sort is a proposal, the rules' says why they were asked, the person's own pick needs no word. */
function byLine(meta: ToldMeta): string | null {
  if (meta.by === 'model') return 'Sorted by AI from what you said. Check it before you keep it.';
  if (meta.by === 'you') return null;
  return meta.why ?? 'Sorted by the app’s own rules.';
}

/**
 * Above every sheet the mic fills in: the words as heard, who sorted them, and
 * the way out when the sort is wrong. A mishearing or a wrong kind is caught
 * here, on the screen, not found in a record a week later.
 */
export function ToldLine({ meta, kind, actions }: { meta: ToldMeta; kind: ToldKind; actions: Actions }) {
  const by = byLine(meta);
  // The money sheet's own "what it heard" box, so the mic reads the same whatever it opened.
  return (
    <div className="cp2-tl">
      <IconMic />
      <div>
        <q>{meta.heard}</q>
        <span>
          {by}{by ? ' ' : ''}
          <button className="cp2-link cp2-tl-else" onClick={() => actions.swapSheet({ kind: 'told', meta })}>Not {TOLD_LABEL[kind].toLowerCase()}?</button>
        </span>
      </div>
    </div>
  );
}

/** The kinds the chooser offers, in the order they are said most. A question is last: it is not a record. */
const CHOICES: ToldKind[] = ['talk', 'sale', 'meeting', 'money', 'offer', 'note', 'question'];

/**
 * What was said, and "what was it?". Picked, the details are read off the
 * words by the app's own rules and the sheet for that kind opens in this one's
 * place. Money is offered only where the shell can open the book.
 */
export function ToldChooser({ meta, home, actions, openMoney }: { meta: ToldMeta; home: HomeData; actions: Actions; openMoney?: (heard: string) => void }) {
  const pick = (k: ToldKind) => {
    if (k === 'money' && openMoney) return openMoney(meta.heard);
    openReading(
      { meta: { heard: meta.heard, by: 'you', why: null }, told: toldAs(k, meta.heard, home.recent.today) },
      { actions, openMoney: openMoney ?? (() => undefined), swap: true },
    );
  };
  return (
    <>
      <h3>What was it?</h3>
      <p className="cp2-tl-heard">&ldquo;{meta.heard}&rdquo;</p>
      {/* Why it is asking: the rules could not tell, or a model failed and said how. */}
      {meta.by === 'rules' && meta.why && <p className="cp-help">{meta.why}</p>}
      <div className="cp2-tl-choices">
        {CHOICES.filter((k) => k !== 'money' || openMoney).map((k) => (
          <button key={k} className="cp-option" onClick={() => pick(k)}>
            <div><div className="ct">{TOLD_LABEL[k]}</div></div>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * A note for the plan, in the words that were said: the same note the Path's
 * "Something changed?" box keeps, and the plan is redrawn from it. Editable, so
 * a misheard word is fixed before it is kept — still the person's words, never
 * a model's version of them.
 */
export function NoteSheet({ home, told, actions, briefing }: { home: HomeData; told: { meta: ToldMeta; content: string }; actions: Actions; briefing: boolean }) {
  const [note, setNote] = useState(told.content);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!note.trim()) return;
    setBusy(true);
    const ok = await actions.addNote(note.trim(), true);
    setBusy(false);
    if (ok) actions.closeSheet();
  };
  return (
    <>
      <ToldLine meta={told.meta} kind="note" actions={actions} />
      <h3>A note for your plan</h3>
      <p className="desc">
        Kept in your words with the rest of what you have told it. {home.roadmap?.enabled ? 'Your plan and tomorrow’s call are redrawn from it.' : 'Tomorrow’s call is weighed with it.'}
      </p>
      <textarea
        className="cp-input sm cp2-tl-note" rows={3} maxLength={NOTE_MAX} value={note} aria-label="The note"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || briefing || !note.trim()} onClick={() => void save()}>{busy ? 'Adding…' : 'Add & re-plan'}</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>
    </>
  );
}
