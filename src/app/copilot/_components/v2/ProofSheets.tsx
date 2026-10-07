'use client';
// Proof's sheets: the chain whole, how buyers find you, an asset and its
// versions, every asset, the history by month, the projects, and the two
// counts a person keeps by hand — their own unit for a bet, and a sale or a
// meeting with no business in the app attached. ProofTab.tsx is the screen.
import { useState } from 'react';
import {
  ASSET_BLURB, ASSET_KINDS, ASSET_LABEL, BODY_MAX, DRAFT_ASK_MAX, NOTE_MAX as ASSET_NOTE_MAX, OFFER_ASSET, TITLE_MAX, URL_MAX,
  type Asset, type AssetKind, type AssetVersion,
} from '@/lib/copilot/assets';
import { linkStatus, type BusinessLink, type LinkKey } from '@/lib/copilot/business';
import { splitThreads } from '@/lib/copilot/commission';
import { shiftDay } from '@/lib/copilot/focus';
import { historyMonths, type HistoryKind } from '@/lib/copilot/history';
import { BET_STATE_LABEL, NOTE_MAX, TALLY_MAX, dayWords, metricWords, resultLine, type BetView } from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { FOUND_BY_HINT, FOUND_BY_LABEL, offerIsEmpty } from '@/lib/copilot/offer';
import { foundOf } from '@/lib/copilot/proof';
import type { ToldMeta, ToldSale } from '@/lib/copilot/tell';
import { FOUND_BY, type FoundBy, type HomeData } from '@/lib/copilot/types';
import { get } from '../api';
import type { Actions } from '../shared';
import { MoveCard } from '../views/NowView';
import { useDerived } from './derive';
import { IconChevron, IconExternal } from './icons2';
import { Count, talkDay } from './LabSheets';
import { MoveNote, MoveRow, agentIsFull, orChat, useBrief, useMove } from './MoveKit';
import { Composer, Project } from './ProjectCard';
import { ToldLine } from './TellSheets';
import { AssetRow, HistoryRow, assetBet } from './ProofTab';

/* ─── The chain, whole ────────────────────────────────────────────────────── */

const RUNNER_LABEL = { ai: 'AI', you: 'You', both: 'AI + you' } as const;

export function ChainSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const d = useDerived(home);
  const { chain, found, lab } = d.proof;
  const brief = useBrief(actions);
  const move = useMove(actions, brief);
  const full = agentIsFull(home);
  // The weak link opens by itself; after a tap, the person decides what is open.
  const [picked, setPicked] = useState<LinkKey | null | undefined>(undefined);
  const open = picked === undefined ? chain.weak : picked;
  return (
    <>
      <h3>How it makes money</h3>
      <p className="desc">Each part is judged by your rows by a rule the app keeps, never by a model. The weak one is where the next test goes.</p>
      <button className="cp2-pf-foundrow" onClick={() => actions.openSheet({ kind: 'foundby' })}>
        <span className="cp2-row-main">
          <span className="t">How buyers find you</span>
          <span className="s">{found.value ? `${FOUND_BY_LABEL[found.value]}${found.said ? '' : ', read from what the app finds and sends'}` : 'Not said yet'}</span>
        </span>
        <IconChevron />
      </button>
      <div className="cp-sheet-embed">
        <ol className="cp-list cp2-bz-chain">
          {chain.links.map((l, i) => (
            <li key={l.key} className={`cp2-bz-part ${l.state}${open === l.key ? ' open' : ''}`}>
              <button className="cp2-bz-part-btn" aria-expanded={open === l.key} onClick={() => setPicked(open === l.key ? null : l.key)}>
                <span className="cp2-bz-rail" aria-hidden><span className="cp2-bz-n">{i + 1}</span></span>
                <span className="cp2-bz-body">
                  <span className="cp2-bz-top">
                    <span className="cp2-bz-name">{l.label}</span>
                    {/* The word travels with the dot — a colour alone is not a verdict. */}
                    <span className={`cp2-bz-state ${l.state}`}><i />{linkStatus(l)}</span>
                  </span>
                  {l.what && <span className={`cp2-bz-what${open === l.key ? '' : ' cp2-clamp2'}`}>{l.what}</span>}
                  {l.facts && <span className="cp2-bz-facts">{l.facts}</span>}
                </span>
              </button>
              {open === l.key && (
                <Part link={l} weak={chain.weak === l.key} bet={lab.current?.bet.part === l.key ? lab.current : null} move={move} full={full} actions={actions} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function Part({ link: l, weak, bet, move, full, actions }: { link: BusinessLink; weak: boolean; bet: BetView | null; move: ReturnType<typeof useMove>; full: boolean; actions: Actions }) {
  return (
    <div className="cp2-bz-detail">
      {weak && <span className="cp2-bz-weak">The weak link</span>}
      <p className="cp2-bz-why">{l.why}</p>
      {l.more.map((m) => <p key={m} className="cp2-bz-more">{m}</p>)}
      {/* Who runs it, where an agent does some of it. A part that is yours alone needs no line saying so. */}
      {l.runner.by !== 'you' && (
        <span className="cp2-bz-runner">
          <span className={`cp2-owner ${l.runner.by}`}>{RUNNER_LABEL[l.runner.by]}</span>
          {l.runner.name}
        </span>
      )}
      {/* An agent that stopped is said on the part of the business it stopped. */}
      {l.runner.problem && <p className="cp2-bz-problem">{l.runner.problem}</p>}
      {bet && (
        <div className="cp2-pf-onpart">
          <span><b>Your test is on this part.</b> Day {bet.day} of {bet.bet.days}, {resultLine(bet)}.</span>
          <button className="cp-btn sm" onClick={actions.closeSheet}>See the test</button>
        </div>
      )}
      {l.moves.length > 0 && (
        <div className="cp2-bz-moves">
          {l.moves.map((raw) => {
            const m = orChat(raw, full);
            return (
              <div key={m.key}>
                <MoveRow m={m} rerouted={m.by !== raw.by} busy={move.busy === m.key} onRun={() => void move.run(m, l.why)} />
                {move.note?.key === m.key && <MoveNote note={move.note} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── How buyers find you ─────────────────────────────────────────────────── */

export function FoundBySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const found = foundOf(home);
  const [busy, setBusy] = useState<FoundBy | 'none' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async (v: FoundBy | null) => {
    setBusy(v ?? 'none'); setError(null);
    const r = await actions.lab({ action: 'found_by', found_by: v });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not save that');
    actions.closeSheet();
  };
  return (
    <>
      <h3>How do buyers find you?</h3>
      <p className="desc">
        The main way. When you reach out, the app counts the businesses it finds, the sends and the replies itself. Every other way, it cannot see them arrive, so your tests count what comes in — enquiries, introductions, walk-ins.
      </p>
      <div className="cp2-pf-options">
        {FOUND_BY.map((f) => (
          <button key={f} className={`cp2-pf-option${found.value === f ? ' on' : ''}`} aria-pressed={found.value === f} disabled={busy !== null} onClick={() => void pick(f)}>
            <b>{busy === f ? 'Saving…' : FOUND_BY_LABEL[f]}</b>
            <span>{FOUND_BY_HINT[f]}</span>
            {found.value === f && !found.said && <em>Read from what the app finds and sends: tap to say it</em>}
          </button>
        ))}
      </div>
      {found.said && (
        <button className="cp2-link cp2-pf-unsay" disabled={busy !== null} onClick={() => void pick(null)}>
          {busy === 'none' ? 'Saving…' : 'Not sure yet: read it from what the app finds and sends'}
        </button>
      )}
      {error && <div className="cp-error">{error}</div>}
    </>
  );
}

/* ─── An asset ────────────────────────────────────────────────────────────── */

export function AssetSheet({ home, id, assetKind, bet, actions }: { home: HomeData; id?: string; assetKind?: AssetKind; bet?: string; actions: Actions }) {
  const asset = id ? home.assets?.assets.find((a) => a.id === id) ?? null : null;
  if (id && !asset) {
    return (
      <>
        <h3>That asset is gone</h3>
        <p className="desc">{home.assets?.unreadable ? `Your assets could not be read just now: ${home.assets.unreadable}` : 'It is not in your assets any more.'}</p>
        <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
      </>
    );
  }
  return asset
    ? <AssetView home={home} asset={asset} actions={actions} />
    : <NewAsset home={home} kind={assetKind} betId={bet} actions={actions} />;
}

const betOf = (home: HomeData, id: string | null) => (id ? home.lab?.bets.find((v) => v.bet.id === id) ?? null : null);

/** "For the bet “…” — Passed": the bet a version was made for, and how the rows judged it. */
function BetLine({ bet }: { bet: BetView }) {
  return (
    <p className={`cp2-pf-betlink ${bet.state}`}>
      {bet.state === 'running' ? 'Made for your test' : 'Made for a test that'} &ldquo;{bet.bet.belief}&rdquo;
      {bet.state !== 'running' && <> · <i className={`cp2-lab-verdict ${bet.state}`}>{BET_STATE_LABEL[bet.state]}</i></>}
    </p>
  );
}

function AssetView({ home, asset: a, actions }: { home: HomeData; asset: Asset; actions: Actions }) {
  const v = a.current;
  const isOffer = a.id === OFFER_ASSET;
  // The offer in use was made for a bet only if that version says so; a draft
  // the AI wrote for one says so in its own box below.
  const bet = betOf(home, isOffer ? v.bet : assetBet(a));
  const running = home.lab?.bets.find((x) => x.state === 'running') ?? null;
  const can = !!home.ai && !offerIsEmpty(home.profile.offer);
  const [mode, setMode] = useState<'view' | 'edit' | 'ai'>('view');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [whole, setWhole] = useState<Asset | null>(null);
  const [openV, setOpenV] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const versions = whole?.versions ?? a.versions;
  // A version the AI wrote is not the offer until the person makes it theirs.
  const newest = a.versions[0];
  const offerWaiting = isOffer && newest.by === 'ai' && a.live !== newest.n ? newest : null;
  const proofUrl = home.profile.offer?.proof_url?.trim() || null;
  // A draft or a version made while the bet it was for still runs stays tied to it.
  const forBet = bet?.state === 'running' ? bet.bet.id : null;

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, after?: () => void) => {
    setBusy(key); setError(null); setNote(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not save that');
    after?.();
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNote('Copied.'); } catch { setNote('Your browser did not let it be copied. Select the text and copy it from there.'); }
  };
  // Older bodies are left out of the home payload; the asset route has them whole.
  const loadWhole = async () => {
    if (whole) return;
    try {
      const r = await get<{ asset: Asset }>(`/assets?id=${encodeURIComponent(a.id)}`);
      setWhole(r.asset);
    } catch (e) {
      setError(`The older versions could not be read just now: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const toggle = (x: AssetVersion) => {
    setOpenV(openV === x.id ? null : x.id);
    if (x.trimmed && !whole) void loadWhole();
  };

  if (mode === 'edit') return <VersionForm asset={a} actions={actions} forBet={forBet} onDone={() => setMode('view')} />;

  return (
    <>
      <div className="cp2-pf-sheet-k">{isOffer ? 'Your offer' : ASSET_LABEL[a.kind]}{a.retired ? ' · put away' : ''}</div>
      <h3>{a.title}</h3>
      <div className="meta">
        <span className="cp2-pf-pill">v{v.n}</span>
        <span className={`cp2-owner ${v.by}`}>{v.by === 'ai' ? 'By AI' : 'By you'}</span>
        {isOffer && a.live === v.n && <span className="cp2-pf-pill live">In use</span>}
        <span className="cp2-pf-when">{v.at ? dayWords(v.at) : 'Before the history began'}</span>
      </div>
      {bet && <BetLine bet={bet} />}

      {offerWaiting && (
        <div className="cp2-pf-adopt">
          <b>v{offerWaiting.n} was drafted by AI{betOf(home, offerWaiting.bet)?.state === 'running' ? ' for your bet' : ''}{offerWaiting.note ? ` — “${offerWaiting.note}”` : ''}.</b> It is not your offer until you make it yours: every message is written from your offer.
          <div className="cp-btn-row">
            <button className="cp-btn primary sm" disabled={busy !== null} onClick={() => void run('adopt', () => actions.assets({ action: 'adopt', version: offerWaiting.id }))}>{busy === 'adopt' ? 'Saving…' : 'Make it my offer'}</button>
            <button className="cp-btn sm" onClick={() => setOpenV(offerWaiting.id)}>Read it first</button>
          </div>
        </div>
      )}

      <div className="cp2-pf-body">
        {v.url && <a className="cp2-pf-url" href={v.url} target="_blank" rel="noreferrer">{v.url.replace(/^https?:\/\//, '').slice(0, 60)} <IconExternal /></a>}
        {v.body && <div className="cp2-pf-text">{v.body}</div>}
        {v.note && <p className="cp2-pf-ver-note">{v.by === 'ai' ? 'Asked for' : 'What changed'}: {v.note}</p>}
        {v.by === 'ai' && v.model && <p className="cp2-pf-ver-note">Written by {v.model}. Check every claim in it before it goes out.</p>}
      </div>

      {mode === 'ai' ? (
        <div className="cp-field">
          <label className="cp-label" htmlFor="cp2-pf-ask">What should change — optional</label>
          <input id="cp2-pf-ask" className="cp-input sm" value={ask} maxLength={DRAFT_ASK_MAX} onChange={(e) => setAsk(e.target.value)} placeholder="Shorter, and lead with the problem" />
          <div className="cp-btn-row">
            <button className="cp-btn primary" disabled={busy !== null} onClick={() => void run('draft', () => actions.assets({ action: 'draft', id: a.id, ask: ask.trim() || undefined, bet: forBet }), () => { setMode('view'); setAsk(''); })}>
              {busy === 'draft' ? 'Drafting…' : 'Draft the next version'}
            </button>
            <button className="cp-btn" disabled={busy !== null} onClick={() => setMode('view')}>Back</button>
          </div>
          <p className="cp-help">Written from your offer, your notes and your rows only. A draft with a number you never gave, a link you did not give or a placeholder is set aside, and you are told which.</p>
        </div>
      ) : (
        <div className="cp2-pf-acts">
          {v.body && <button className="cp-btn sm" onClick={() => void copy(v.body!)}>Copy the text</button>}
          {a.kind === 'demo' && v.url && v.url !== proofUrl && (
            <button className="cp-btn sm" disabled={busy !== null} onClick={() => void run('proof', () => actions.assets({ action: 'proof', id: a.id }))}>{busy === 'proof' ? 'Saving…' : 'Use as the proof in messages'}</button>
          )}
          {isOffer
            ? <button className="cp-btn sm" onClick={() => actions.openSheet({ kind: 'offer', bet: running?.bet.id })}>Edit your offer</button>
            : <button className="cp-btn sm" onClick={() => setMode('edit')}>New version</button>}
          {can && <button className="cp-btn sm" onClick={() => setMode('ai')}>Rewrite with AI</button>}
          {!isOffer && (
            <button className="cp2-link muted" disabled={busy !== null} onClick={() => void run('away', () => actions.assets({ action: a.retired ? 'restore' : 'retire', id: a.id }))}>
              {busy === 'away' ? 'Saving…' : a.retired ? 'Bring it back' : 'Put it away'}
            </button>
          )}
        </div>
      )}
      {error && <div className="cp-error">{error}</div>}
      {note && <p className="cp-help">{note}</p>}

      <div className="cp2-pf-vers">
        <span className="cp2-pf-k">Versions</span>
        {versions.map((x) => {
          const xb = betOf(home, x.bet);
          const live = isOffer ? a.live === x.n : x.id === v.id;
          return (
            <div key={x.id} className={`cp2-pf-ver${openV === x.id ? ' open' : ''}`}>
              <button className="cp2-pf-ver-head" aria-expanded={openV === x.id} onClick={() => toggle(x)}>
                <span className="cp2-pf-ver-n">v{x.n}</span>
                <span className="cp2-row-main">
                  <span className="t cp2-clamp1">{x.title}</span>
                  <span className="s">{[x.by === 'ai' ? 'By AI' : 'By you', x.at ? dayWords(x.at) : 'undated', live ? (isOffer ? 'in use' : 'current') : null, x.note].filter(Boolean).join(' · ')}</span>
                  {xb && <span className="s">For &ldquo;{xb.bet.belief}&rdquo;{xb.state !== 'running' ? ` · ${BET_STATE_LABEL[xb.state]}` : ''}</span>}
                </span>
                <IconChevron />
              </button>
              {openV === x.id && (
                <div className="cp2-pf-ver-body">
                  {x.url && <a className="cp2-pf-url" href={x.url} target="_blank" rel="noreferrer">{x.url.replace(/^https?:\/\//, '').slice(0, 60)} <IconExternal /></a>}
                  {x.body
                    ? <div className="cp2-pf-text">{x.body}</div>
                    : x.trimmed ? <p className="cp-help">{whole ? 'This version has no text.' : 'Reading it…'}</p> : null}
                  {isOffer && !live && x.offer?.sells && (
                    <button className="cp-btn sm" disabled={busy !== null} onClick={() => void run(`adopt-${x.id}`, () => actions.assets({ action: 'adopt', version: x.id }))}>
                      {busy === `adopt-${x.id}` ? 'Saving…' : `Make v${x.n} my offer`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The next version, by you: what it is now, changed. Nothing is edited in place — the old one stays in the list. */
function VersionForm({ asset: a, actions, forBet, onDone }: { asset: Asset; actions: Actions; forBet: string | null; onDone: () => void }) {
  const v = a.current;
  const [title, setTitle] = useState(v.title);
  const [url, setUrl] = useState(v.url ?? '');
  const [body, setBody] = useState(v.body ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    const r = await actions.assets({ action: 'version', id: a.id, bet: forBet, asset: { title: title.trim(), url: url.trim() || undefined, body: body.trim() || undefined, note: note.trim() || undefined } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not save it');
    onDone();
  };
  return (
    <>
      <div className="cp2-pf-sheet-k">{ASSET_LABEL[a.kind]} · v{a.versions[0].n + 1}</div>
      <h3>The next version</h3>
      <p className="desc">Saved as v{a.versions[0].n + 1}, by you. v{v.n} stays in the list, so what each one did can still be read.</p>
      <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-vt">Name</label><input id="cp2-pf-vt" className="cp-input sm" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-vu">Link — optional</label><input id="cp2-pf-vu" className="cp-input sm" type="url" inputMode="url" value={url} maxLength={URL_MAX} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
      <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-vb">The text</label><textarea id="cp2-pf-vb" className="cp-input sm" value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-vn">What changed — optional</label><input id="cp2-pf-vn" className="cp-input sm" value={note} maxLength={ASSET_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Price said up front" /></div>
      {error && <div className="cp-error">{error}</div>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || (!url.trim() && !body.trim())} onClick={() => void save()}>{busy ? 'Saving…' : `Save v${a.versions[0].n + 1}`}</button>
        <button className="cp-btn" disabled={busy} onClick={onDone}>Back</button>
      </div>
    </>
  );
}

/** A new asset: a link, a text, or both — by you, or drafted by AI from the offer and the rows. */
function NewAsset({ home, kind: asked, betId, actions }: { home: HomeData; kind?: AssetKind; betId?: string; actions: Actions }) {
  const [kind, setKind] = useState<AssetKind | null>(asked ?? null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState<'save' | 'draft' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bet = betOf(home, betId ?? null);
  const can = !!home.ai && !offerIsEmpty(home.profile.offer);

  const done = (r: { ok: boolean; error?: string; id?: string }) => {
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not save it');
    // Onto the asset just made, so what was saved or drafted is read straight away.
    if (r.id) { actions.closeSheet(); actions.openSheet({ kind: 'asset', id: r.id }); }
  };
  const save = async () => {
    if (!kind) return;
    setBusy('save'); setError(null);
    done(await actions.assets({ action: 'add', bet: bet?.bet.id ?? null, asset: { kind, title: title.trim() || undefined, url: url.trim() || undefined, body: body.trim() || undefined } }));
  };
  const draft = async () => {
    if (!kind) return;
    setBusy('draft'); setError(null);
    done(await actions.assets({ action: 'draft', kind, bet: bet?.bet.id ?? null, ask: ask.trim() || undefined }));
  };

  if (kind === 'offer') {
    return (
      <>
        <h3>Your offer</h3>
        <p className="desc">There is one offer, and every message is written from it, so it is changed on its own sheet. Each save is a new version in its history{bet ? `, kept as written for the test “${bet.bet.belief}”` : ''}.</p>
        {error && <div className="cp-error">{error}</div>}
        <div className="cp-btn-row">
          <button className="cp-btn primary" onClick={() => actions.openSheet({ kind: 'offer', bet: bet?.bet.id })}>Edit your offer</button>
          {can && <button className="cp-btn" disabled={busy !== null} onClick={() => void draft()}>{busy === 'draft' ? 'Drafting…' : 'Draft a version with AI'}</button>}
        </div>
      </>
    );
  }

  return (
    <>
      <h3>{kind ? `A new ${ASSET_LABEL[kind].toLowerCase()}` : 'A new asset'}</h3>
      <p className="desc">
        {kind ? ASSET_BLURB[kind] : 'Something the business sells with.'}
        {bet ? ` Kept with the test “${bet.bet.belief}”.` : ''}
      </p>
      {!asked && (
        <div className="cp-field">
          <label className="cp-label">What it is</label>
          <div className="cp-chips">
            {ASSET_KINDS.filter((k) => k !== 'offer').map((k) => (
              <button key={k} className={`cp-fchip ${kind === k ? 'active' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{ASSET_LABEL[k]}</button>
            ))}
          </div>
        </div>
      )}
      {kind && (
        <>
          <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-nt">Name — optional</label><input id="cp2-pf-nt" className="cp-input sm" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={ASSET_LABEL[kind]} /></div>
          <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-nu">A link to it</label><input id="cp2-pf-nu" className="cp-input sm" type="url" inputMode="url" value={url} maxLength={URL_MAX} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="cp-field"><label className="cp-label" htmlFor="cp2-pf-nb">Or write it out</label><textarea id="cp2-pf-nb" className="cp-input sm" value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} /></div>
          {error && <div className="cp-error">{error}</div>}
          <button className="cp-btn primary block" disabled={busy !== null || (!url.trim() && !body.trim())} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save it, by you'}</button>
          {can && (
            <div className="cp2-pf-orai">
              <span className="cp2-pf-k">Or have AI draft it</span>
              <input className="cp-input sm" value={ask} maxLength={DRAFT_ASK_MAX} onChange={(e) => setAsk(e.target.value)} placeholder="What it should say — optional" aria-label="What it should say, optional" />
              <button className="cp-btn block" disabled={busy !== null} onClick={() => void draft()}>{busy === 'draft' ? 'Drafting… up to half a minute' : `Draft the ${ASSET_LABEL[kind].toLowerCase()}`}</button>
              <p className="cp-help">From your offer, your notes and your rows only. It is yours to keep, rewrite or put away; nothing is sent.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ─── Every asset ─────────────────────────────────────────────────────────── */

export function AssetsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const assets = home.assets?.assets ?? [];
  const bets = home.lab?.bets ?? [];
  const live = assets.filter((a) => !a.retired);
  const away = assets.filter((a) => a.retired);
  return (
    <>
      <h3>Assets</h3>
      <p className="desc">What the business sells with. Every change is a new version, by AI or by you, and each says the test it was made for.</p>
      <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'asset' })}>Add an asset</button>
      {home.assets?.unreadable && <div className="cp-error">Could not read your assets just now: {home.assets.unreadable}</div>}
      <div className="cp-sheet-embed cp2-pf-sheetlist">
        {live.length > 0 && <div className="cp-list cp2-rows cp2-pf-assets">{live.map((a) => <AssetRow key={a.id} a={a} bets={bets} actions={actions} />)}</div>}
        {away.length > 0 && (
          <>
            <div className="cp-section"><span className="lead">Put away</span><span className="count">{away.length}</span></div>
            <div className="cp-list cp2-rows cp2-pf-assets">{away.map((a) => <AssetRow key={a.id} a={a} bets={bets} actions={actions} />)}</div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── The history, whole ──────────────────────────────────────────────────── */

const FILTERS: Array<{ key: string; label: string; kinds: HistoryKind[] | null }> = [
  { key: 'all', label: 'All', kinds: null },
  { key: 'bets', label: 'Tests', kinds: ['bet_start', 'bet_end', 'checkpoint', 'experiment'] },
  { key: 'assets', label: 'Assets', kinds: ['asset'] },
  { key: 'sales', label: 'Sales', kinds: ['win'] },
  { key: 'talks', label: 'Conversations', kinds: ['talk'] },
  { key: 'projects', label: 'Projects', kinds: ['project'] },
];

export function HistorySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const d = useDerived(home);
  const [f, setF] = useState('all');
  const all = d.proof.history;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const entries = filter.kinds ? all.filter((e) => filter.kinds!.includes(e.kind)) : all;
  const months = historyMonths(entries, home.recent.today);
  const before = d.proof.said.tried ?? [];
  const count = (x: (typeof FILTERS)[number]) => (x.kinds ? all.filter((e) => x.kinds!.includes(e.kind)).length : all.length);
  return (
    <>
      <h3>History</h3>
      <p className="desc">What was tried, made, decided and paid, newest first — from your own rows, nothing summarised by a model. Tests that did not pass stay: they are the cheapest lessons the business gets.</p>
      <div className="cp-chips">
        {FILTERS.filter((x) => x.key === 'all' || count(x) > 0).map((x) => (
          <button key={x.key} className={`cp-fchip ${f === x.key ? 'active' : ''}`} aria-pressed={f === x.key} onClick={() => setF(x.key)}>{x.label} {count(x)}</button>
        ))}
      </div>
      <div className="cp-sheet-embed cp2-pf-sheetlist">
        {months.map((m) => (
          <div key={m.key}>
            <div className="cp-section"><span className="lead">{m.label}</span><span className="count">{m.entries.length}</span></div>
            <div className="cp-list cp2-rows cp2-pf-history">{m.entries.map((e) => <HistoryRow key={e.key} e={e} today={home.recent.today} actions={actions} />)}</div>
          </div>
        ))}
        {!entries.length && <p className="cp-help">Nothing here yet. It fills as you test, make, decide and sell.</p>}
        {before.length > 0 && (f === 'all' || f === 'bets') && (
          <>
            <div className="cp-section"><span className="lead">Before the app</span></div>
            <div className="cp-list cp2-rows">
              {before.map((line, i) => (
                <div key={`before-${i}`} className="cp2-row">
                  <span className="cp2-row-main"><span className="t">{line}</span><span className="s">In your words</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Projects ────────────────────────────────────────────────────────────── */

export function ProjectsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const d = useDerived(home);
  const brief = useBrief(actions);
  const full = agentIsFull(home);
  const jobs = splitThreads(home.commissions ?? []);
  const live = [...jobs.needsYou, ...jobs.running];
  const finished = [...jobs.finished].sort((a, b) => (b.commission.closed_at ?? '').localeCompare(a.commission.closed_at ?? ''));
  // What the app offers to take on. The one on the call is on the Path already.
  const offers = home.moves.filter((m) => m.artifact?.kind === 'plan');
  const bets = home.lab?.bets ?? [];
  const links = home.lab?.links ?? {};
  const betFor = (id: string) => bets.find((v) => (links[v.bet.id] ?? []).includes(id)) ?? null;
  return (
    <>
      <h3>Projects</h3>
      <p className="desc">Hand over anything you would otherwise do yourself. It researches, compares and drafts while you do something else, reports every step, and never contacts anyone or spends anything.</p>
      <div className="cp-sheet-embed cp2-pf-sheetlist">
        <Composer home={home} d={d} actions={actions} brief={brief} full={full} />
        {live.length > 0 && (
          <>
            <div className="cp-section"><span className="lead">On the go</span>{d.proof.waiting > 0 && <span className="count">{d.proof.waiting} waiting on you</span>}</div>
            <div className="cp2-pf-projects">{live.map((t) => <Project key={t.commission.id} thread={t} actions={actions} />)}</div>
          </>
        )}
        {offers.map((m) => (
          <div key={m.id} className="cp2-pf-offer">
            <div className="cp2-offer-label">It offers to take this on</div>
            <MoveCard move={m} actions={actions} />
          </div>
        ))}
        {finished.length > 0 && (
          <>
            <div className="cp-section"><span className="lead">Finished</span><span className="count">{finished.length}</span></div>
            <div className="cp-list cp2-rows">
              {finished.slice(0, 30).map((t) => {
                const c = t.commission;
                const bet = betFor(c.id);
                return (
                  <button key={c.id} className="cp2-row" onClick={() => actions.openSheet({ kind: 'commission', id: c.id })}>
                    <span className="cp2-row-main">
                      <span className="t cp2-clamp2">{c.objective}</span>
                      <span className="s cp2-clamp2">{[c.status === 'done' ? 'Finished' : 'Stopped', c.closed_at ? dayWords(c.closed_at) : null, c.outcome, bet ? `for “${bet.bet.belief}”` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <IconChevron />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {/* A read that failed is not "nothing was built" (invariant 13). */}
      {home.built?.unreadable && finished.length > 0 && <div className="cp-note">Could not read what the projects produced, so their counts may be short: {home.built.unreadable}</div>}
    </>
  );
}

/* ─── A count the person keeps ────────────────────────────────────────────── */

export function CountSheet({ home, betId, actions }: { home: HomeData; betId: string; actions: Actions }) {
  const view = home.lab?.bets.find((v) => v.bet.id === betId) ?? null;
  const today = home.recent.today;
  // The last day a count can land on: the bet's own, never one not lived yet.
  const lastDay = view ? (view.last < today ? view.last : today) : today;
  const [n, setN] = useState(1);
  const [on, setOn] = useState(lastDay);
  const [other, setOther] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(0);
  if (!view) {
    return (
      <>
        <h3>That test is gone</h3>
        <p className="desc">It is not in your record any more.</p>
        <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
      </>
    );
  }
  const b = view.bet;
  const tallies = (home.lab?.tallies ?? []).filter((t) => t.bet === betId);
  const yesterday = shiftDay(lastDay, -1);
  const save = async () => {
    setBusy(true); setError(null);
    const r = await actions.lab({ action: 'count', bet: betId, count: { n, on, note: note.trim() || undefined } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not log that');
    setN(1); setNote(''); setLogged((x) => x + 1);
  };
  const remove = async (id: string) => {
    setError(null);
    const r = await actions.lab({ action: 'uncount', id });
    if (!r.ok) setError(r.error ?? 'Could not remove that');
  };
  return (
    <>
      <h3>Log {b.unit ?? 'a count'}</h3>
      <p className="desc">
        For the test &ldquo;{b.belief}&rdquo;: {resultLine(view)} so far. The app cannot see these arrive, so the count is yours, kept apart from the ones it takes itself.
      </p>
      <div className="cp-field">
        <label className="cp-label">How many</label>
        <div className="cp2-lab-countrow">
          <Count value={n} min={1} max={TALLY_MAX} coarse onChange={setN} label={metricWords('logged', 2, null, b.unit)} />
          <span>{metricWords('logged', n, null, b.unit)}</span>
        </div>
      </div>
      <div className="cp-field">
        <label className="cp-label">When</label>
        <div className="cp-chips">
          <button className={`cp-fchip ${!other && on === lastDay ? 'active' : ''}`} onClick={() => { setOther(false); setOn(lastDay); }}>{lastDay === today ? 'Today' : dayWords(lastDay)}</button>
          {yesterday >= b.start && <button className={`cp-fchip ${!other && on === yesterday ? 'active' : ''}`} onClick={() => { setOther(false); setOn(yesterday); }}>{lastDay === today ? 'Yesterday' : dayWords(yesterday)}</button>}
          {shiftDay(lastDay, -2) >= b.start && <button className={`cp-fchip ${other ? 'active' : ''}`} onClick={() => { setOther(true); setOn(shiftDay(lastDay, -2)); }}>Earlier</button>}
        </div>
        {other && (
          <input type="date" className="cp-input sm cp2-lab-date" aria-label="The day they came in" value={on} min={b.start} max={lastDay} onChange={(e) => e.target.value && setOn(e.target.value)} />
        )}
        <p className="cp-help">Only the test&rsquo;s own days count: {dayWords(b.start)} to {dayWords(view.last)}.</p>
      </div>
      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-pf-cn">Note — optional</label>
        <input id="cp2-pf-cn" className="cp-input sm" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Two from the Facebook group" />
      </div>
      {error && <div className="cp-error">{error}</div>}
      {logged > 0 && !error && <p className="cp-help">{logged === 1 ? 'Logged.' : `${logged} logged.`} Add the next, or Done.</p>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={() => void save()}>{busy ? 'Logging…' : 'Log it'}</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Done</button>
      </div>
      {tallies.length > 0 && (
        <div className="cp2-lab-talklist">
          {tallies.map((t) => (
            <div key={t.id} className="cp2-lab-talk cp2-pf-tally">
              <div className="cp2-lab-talk-top">
                <b>{t.n} {metricWords('logged', t.n, null, b.unit)}</b>
                <span className="cp2-lab-talk-when">{talkDay(t.on, today)}</span>
                <button className="cp2-x" onClick={() => void remove(t.id)} aria-label={`Remove ${t.n} logged ${talkDay(t.on, today)}`}>×</button>
              </div>
              {t.note && <span className="cp2-lab-talk-s">{t.note}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── A sale or a meeting from outside the app ────────────────────────────── */

/**
 * A sale or a meeting, logged by hand. `told` is one said into the mic: the
 * amount and currency said, who, and the day — offered beside today when it was
 * another one ("Pia paid me yesterday"), so a sale lands on the day it happened.
 */
export function SaleSheet({ home, outcome, told, actions }: { home: HomeData; outcome: 'won' | 'meeting'; told?: { meta: ToldMeta; sale: ToldSale }; actions: Actions }) {
  const t = told?.sale;
  const today = home.recent.today;
  const [amount, setAmount] = useState(t?.amount ?? '');
  const [currency, setCurrency] = useState(t?.currency ?? salesCurrency(home.profile.finance, home.goals));
  const [who, setWho] = useState(t?.who ?? '');
  const [on, setOn] = useState(t?.on ?? today);
  const [busy, setBusy] = useState(false);
  const won = outcome === 'won';
  const n = Number(amount.replace(/,/g, ''));
  const bad = won && amount.trim() !== '' && !(Number.isFinite(n) && n >= 0);
  // Only a day that was said is offered: the sheet logs today otherwise, as it always has.
  const saidDay = t?.on && t.on !== today ? t.on : null;
  const save = async () => {
    setBusy(true);
    await actions.recordOutcome({
      kind: outcome,
      amount: won && amount.trim() ? n : undefined,
      currency: won ? currency : undefined,
      note: who.trim() || undefined,
      on: on !== today ? on : undefined,
    });
    setBusy(false);
  };
  return (
    <>
      {told && <ToldLine meta={told.meta} kind={won ? 'sale' : 'meeting'} actions={actions} />}
      <h3>{won ? 'Log a sale' : 'Log a meeting'}</h3>
      <p className="desc">
        {won
          ? 'A sale from anyone — a walk-in, a referral, a listing. It counts toward your test from today, and the amount lands on your money goal. A promise to pay is not one yet.'
          : 'A meeting with someone who could buy, booked or held today. It counts toward your test from today.'}
      </p>
      {won && (
        <div className="cp-field">
          <label className="cp-label">Amount / currency</label>
          <div className="cp-input-row">
            <input className="cp-input" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150" aria-label="Amount" />
            <input className="cp-input" style={{ maxWidth: 84 }} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} aria-label="Currency" />
          </div>
          {bad && <p className="cp-help cp2-err">That is not an amount.</p>}
        </div>
      )}
      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-pf-sw">Who — optional</label>
        <input id="cp2-pf-sw" className="cp-input sm" value={who} maxLength={80} onChange={(e) => setWho(e.target.value)} placeholder="Maria, Sunrise Dental" />
      </div>
      {saidDay && (
        <div className="cp-field">
          <label className="cp-label">When</label>
          <div className="cp-chips">
            <button className={`cp-fchip ${on === saidDay ? 'active' : ''}`} aria-pressed={on === saidDay} onClick={() => setOn(saidDay)}>{talkDay(saidDay, today)}</button>
            <button className={`cp-fchip ${on === today ? 'active' : ''}`} aria-pressed={on === today} onClick={() => setOn(today)}>Today</button>
          </div>
        </div>
      )}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || bad} onClick={() => void save()}>{busy ? 'Logging…' : won ? 'Log the sale' : 'Log the meeting'}</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>
    </>
  );
}
