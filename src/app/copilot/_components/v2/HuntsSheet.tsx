'use client';
// What it looks for, as one list: places on Maps, the user's hunts, and the
// sources it reads. Three storage places behind it — targeting, copilot_hunts,
// copilot_sources — and one question in front: what is this thing searching for
// on my behalf, and is each search earning its place.
//
// Every hunt says how it is doing in one line (huntLine), and a hunt that cannot
// run, failed, or keeps bringing in things nobody drafts says so in that line —
// a search that broke must never read like a quiet one (invariant 13).
//
// An agent hunt is a commission. Adding one writes the mandate as a draft and
// opens it, because granting it is the second, deliberate act that layer exists
// for; this sheet never grants anything itself.
import { useState } from 'react';
import {
  HUNT_KINDS, HUNT_KIND_BLURB, HUNT_KIND_LABEL, MAX_HUNTS, huntLine, sameHunt,
  type HuntKind, type HuntSuggestion, type HuntView,
} from '@/lib/copilot/hunts';
import { offerIsEmpty } from '@/lib/copilot/offer';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

export default function HuntsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const h = home.hunting;
  const segments = home.profile.target_segments;
  const where = home.profile.target_area || home.profile.location || null;
  // Open on arrival when there is nothing yet — but never over a table that is
  // not there: a form that cannot save is a promise the sheet cannot keep.
  const [adding, setAdding] = useState(h.hunts.length === 0 && !h.unreadable);
  const [looking, setLooking] = useState(false);
  const unrun = h.hunts.some((x) => x.status === 'active' && x.kind !== 'agent' && !x.last_run_at);
  const sources = home.watchSources;
  const failing = sources.filter((s) => !!s.last_error).length;

  return (
    <>
      <h3>What it looks for</h3>
      <p className="desc">
        Everything below runs every night, in your words, and what it finds lands on Matches under the search that found it —
        so you can see which ones bring in people worth writing to.
      </p>
      {h.unreadable && <div className="cp-note">{h.unreadable}</div>}

      <div className="cp-section"><span className="lead">Places on Google Maps</span></div>
      <div className="cp-src">
        <div className="ct">{segments.length ? <>{segments.join(', ')}{where ? <> in {where}</> : null}</> : 'Not searching Maps'}</div>
        <div className="cs">Each segment is searched exactly as typed, as &ldquo;segment in area&rdquo;. Right for shops and trades with a listing and a phone.</div>
        <div className="acts"><button className="cp-connect" onClick={() => actions.openSheet({ kind: 'targeting' })}>{segments.length ? 'Edit' : 'Set up'}</button></div>
      </div>

      <div className="cp-section">
        <span className="lead">Your hunts</span>
        {unrun && (
          <button className="link" disabled={looking} onClick={async () => { setLooking(true); await actions.findMatches(); setLooking(false); }}>
            {looking ? 'Looking…' : 'Look now'}
          </button>
        )}
      </div>
      {!h.hunts.length && !adding && (
        <p className="desc">None yet. A hunt is one line — who, in your words — and it runs every night beside Maps.</p>
      )}
      {h.hunts.map((x) => <HuntRow key={x.id} hunt={x} home={home} actions={actions} />)}

      {adding && !h.unreadable
        ? <AddHunt home={home} actions={actions} onDone={() => setAdding(false)} />
        : h.hunts.length < MAX_HUNTS && !h.unreadable && (
          <button className="cp-btn block" style={{ marginTop: 4 }} onClick={() => setAdding(true)}>Add a hunt</button>
        )}
      {h.hunts.length >= MAX_HUNTS && <p className="cp-help">That is {MAX_HUNTS}. Remove one before adding another — past that the chips stop being a filter.</p>}

      {!h.unreadable && h.hunts.length < MAX_HUNTS && <Suggestions home={home} actions={actions} />}

      <div className="cp-section"><span className="lead">Posts from sources you watch</span></div>
      <div className="cp-src">
        <div className="ct">{sources.length ? `Reading ${sources.length} source${sources.length === 1 ? '' : 's'}` : 'Not watching anything yet'}</div>
        <div className={`cs ${failing ? 'warn' : ''}`}>
          {failing ? `${failing} of them failed on the last read — open Sources to see why.` : 'Gigs, roles, people and signals, read every night.'}
        </div>
        <div className="acts"><button className="cp-connect" onClick={() => actions.openSheet({ kind: 'watchlist' })}>{sources.length ? 'Sources' : 'Add one'}</button></div>
      </div>

      <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Done</button></div>
    </>
  );
}

function HuntRow({ hunt, home, actions }: { hunt: HuntView; home: HomeData; actions: Actions }) {
  const [arming, setArming] = useState(false);
  const commission = hunt.commission_id ? home.commissions.find((t) => t.commission.id === hunt.commission_id)?.commission ?? null : null;
  const line = huntLine(hunt, hunt.yield, { webReady: home.hunting.webReady, workerReady: home.workerConnected, commission });
  const waiting = hunt.yield.waiting;
  // A mandate the worker is holding is called off from its own sheet, which asks
  // what it was worth; removing the hunt here would close it with no verdict.
  const held = hunt.kind === 'agent' && !!commission && (commission.status === 'active' || commission.status === 'blocked');
  return (
    <div className="cp-src">
      <div className="ct"><span className={`cp2-huntkind ${hunt.kind}`}>{HUNT_KIND_LABEL[hunt.kind]}</span>{hunt.query}{hunt.area ? <span className="cp2-huntarea"> · {hunt.area}</span> : null}</div>
      <div className={`cs ${line.tone === 'warn' ? 'warn' : ''}`}>{line.text}</div>
      {arming && held ? (
        <>
          <div className="cs">It is still with the worker. Call the project off first — its sheet asks what it was worth, so the record can count it.</div>
          <div className="acts">
            <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'commission', id: commission!.id })}>Open the project</button>
            <button className="cp-connect ghost" onClick={() => setArming(false)}>Keep it</button>
          </div>
        </>
      ) : arming ? (
        <>
          <div className="cs">
            {waiting ? `Removes it and sets aside the ${waiting} it found that nobody has answered. ` : 'Removes it. '}
            {hunt.kind === 'agent' && commission?.status === 'draft' ? 'The draft project goes with it. ' : ''}
            Anything already drafted, sent or replied to stays.
          </div>
          <div className="acts">
            <button className="cp-connect" onClick={() => void actions.removeHunt(hunt.id)}>Remove it</button>
            <button className="cp-connect ghost" onClick={() => setArming(false)}>Keep it</button>
          </div>
        </>
      ) : (
        <div className="acts">
          {hunt.kind === 'agent' ? (
            commission?.status === 'draft' ? <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'commission', id: commission.id })}>Hand it over</button>
              : commission && (commission.status === 'active' || commission.status === 'blocked') ? <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'commission', id: commission.id })}>Open the project</button>
              : <button className="cp-connect" onClick={() => void actions.rerunHunt(hunt.id)}>Run again</button>
          ) : hunt.status === 'active'
            ? <button className="cp-connect ghost" onClick={() => void actions.setHuntStatus(hunt.id, 'paused')}>Pause</button>
            : <button className="cp-connect" onClick={() => void actions.setHuntStatus(hunt.id, 'active')}>Resume</button>}
          <button className="cp-connect ghost" onClick={() => setArming(true)}>Remove</button>
        </div>
      )}
    </div>
  );
}

function AddHunt({ home, actions, onDone, seed }: { home: HomeData; actions: Actions; onDone: () => void; seed?: HuntSuggestion }) {
  const [kind, setKind] = useState<HuntKind>(seed?.kind ?? 'companies');
  const [query, setQuery] = useState(seed?.query ?? '');
  const [area, setArea] = useState(seed?.area ?? home.profile.target_area ?? home.profile.location ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The placeholder is their own words where there are any: the first buyer
  // they named, which is what most first hunts turn out to be.
  const firstBuyer = (home.profile.offer?.for_who ?? '').split(/[,;]/)[0]?.trim();
  const placeholder = kind === 'people' ? `owners or buyers at ${firstBuyer || 'the businesses you sell to'}`
    : kind === 'agent' ? `a list only a person could put together — ${firstBuyer || 'events, directories'}`
    : firstBuyer || 'the kind of business that buys from you';
  const save = async () => {
    setBusy(true); setError(null);
    const r = await actions.saveHunt({ kind, query, area: area.trim() || null, origin: seed ? 'suggested' : 'user' });
    setBusy(false);
    if (r.ok) onDone(); else setError(r.error ?? 'Could not add that hunt');
  };
  return (
    <div className="cp-src cp2-huntform">
      <div className="cp-btn-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 0 }}>
        {HUNT_KINDS.map((k) => (
          <button key={k} className={`cp-chip ${kind === k ? 'ai' : 'you'}`} disabled={k === 'agent' && !home.workerConnected} onClick={() => setKind(k)}>{HUNT_KIND_LABEL[k]}</button>
        ))}
      </div>
      <div className="cs" style={{ marginTop: 8 }}>
        {kind === 'agent' && !home.workerConnected ? 'No research worker is connected to this app, so there is nobody to hand an agent hunt to.' : HUNT_KIND_BLURB[kind]}
      </div>
      <div className="cp-field" style={{ marginTop: 12 }}>
        <label className="cp-label">Who, in your words</label>
        <input className="cp-input sm" value={query} maxLength={120} onChange={(e) => { setQuery(e.target.value); setError(null); }} placeholder={placeholder} />
      </div>
      <div className="cp-field">
        <label className="cp-label">Where — optional</label>
        <input className="cp-input sm" value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} placeholder="City, Country" />
      </div>
      {error && <div className="cp-note">{error}</div>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || query.trim().length < 3 || (kind === 'agent' && !home.workerConnected)} onClick={() => void save()}>
          {busy ? 'Adding…' : kind === 'agent' ? 'Write it as a draft' : 'Add hunt'}
        </button>
        <button className="cp-btn" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function Suggestions({ home, actions }: { home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<HuntSuggestion[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<HuntSuggestion | null>(null);
  const noOffer = offerIsEmpty(home.profile.offer);
  const taken = home.hunting.hunts.map((x) => x.query);
  const ask = async () => {
    setBusy(true); setNote(null);
    const r = await actions.suggestHunts();
    setBusy(false);
    if (!r.ok) { setNote(r.error ?? 'Could not suggest hunts'); return; }
    setList(r.suggestions ?? []);
    setNote(r.note ?? ((r.suggestions ?? []).length ? null : 'Nothing new to suggest from what you have written.'));
  };
  return (
    <>
      <div className="cp-section">
        <span className="lead">Suggested from what you sell</span>
        <button className="link" disabled={busy || noOffer} onClick={() => void ask()}>{busy ? 'Thinking…' : list ? 'Again' : 'Suggest'}</button>
      </div>
      {noOffer && <p className="desc" style={{ marginTop: -6 }}>Say what you sell first — suggestions are read from it, never guessed.</p>}
      {note && <div className="cp-note">{note}</div>}
      {editing
        ? <AddHunt home={home} actions={actions} seed={editing} onDone={() => { setList((l) => l?.filter((s) => s !== editing) ?? null); setEditing(null); }} />
        : list?.filter((s) => !taken.some((q) => sameHunt(q, s.query))).map((s) => (
          // Opens in the form rather than adding on tap: a suggestion becomes a
          // hunt only in the user's words, and the form is where they change them.
          <button key={`${s.kind}:${s.query}`} className="cp-option" onClick={() => setEditing(s)}>
            <div>
              <div className="ct"><span className={`cp2-huntkind ${s.kind}`}>{HUNT_KIND_LABEL[s.kind]}</span>{s.query}{s.area ? ` · ${s.area}` : ''}</div>
              {s.why && <div className="cs">{s.why}</div>}
            </div>
          </button>
        ))}
    </>
  );
}
