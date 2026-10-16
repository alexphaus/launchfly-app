// src/lib/copilot/you.ts
// Text about the person, said to them.
//
// Why. The app speaks to one person in the second person (CLAUDE.md, house
// style), and the words other writers put on its screens did not: an idea read
// "message 10 people the owner knows", and a worker's report read "drafted the
// missing approval gate so Alex can move from a verbal yes" — on Alex's own
// phone, about Alex. The writers are told now (ideas.ts, brieftext.ts); this is
// for what they already wrote, and what slips. Read on the way to the screen,
// never written back: the record keeps the words as they were sent.
//
// Narrow on purpose. "The owner" is rewritten wherever it stands, because it is
// only ever the person. A name is rewritten only where it is plainly them — the
// possessive, the subject of "can", "needs" and the like, the object of "for" or
// "help" — because "Mark the step done" and "ALEX CLIENT PLAYBOOK" must survive.
// What it cannot fix safely it leaves: about the person reads oddly; garbled
// reads broken.
//
// Pure: no imports.

const BE: Record<string, string> = {
  is: 'are', was: 'were', has: 'have', does: 'do',
  "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", "doesn't": "don't",
};

/** A third-person verb, as "you" takes it: knows → know, reaches → reach, tries → try, is → are. Anything else as it is. */
export function youVerb(v: string): string {
  const low = v.toLowerCase();
  if (BE[low]) return BE[low];
  if (/(?:ss|sh|ch|x|z)es$/.test(low) || /oes$/.test(low)) return v.slice(0, -2);
  if (/[^aeiou]ies$/.test(low)) return `${v.slice(0, -3)}y`;
  if (/[^su]s$/.test(low)) return v.slice(0, -1);
  return v;
}

const ADVERBS = 'already|also|often|usually|still|never|only|just|now|then|really|always|currently|personally|first';
/** After the person, these make them the subject whoever they are: modals and the verbs a report uses. */
const SUBJECT_VERB = /^(?:can|could|will|would|should|may|might|must|wants?|needs?|has|had|is|was|does|did|gets?|knows?|keeps?|takes?|sells?|offers?|runs?|sees?|says?|uses?|moves?|isn't|wasn't|hasn't|doesn't|can't|won't|couldn't|wouldn't)$/i;
/** Any -s verb, for "the owner", which is never a noun's modifier. */
const S_VERB = /^[a-z][a-z’']*s$/;
/** Before the person, these make them the object: "introduce the owner to", "for Alex", "help the owner". */
const OBJECT_BEFORE = /\b(?:to|for|with|from|of|by|about|on|at|give|gives|ask|asks|help|helps|tell|tells|show|shows|introduce|introduces|send|sends|let|lets|make|makes|get|gets|bring|brings|connect|connects|refer|refers|pay|pays|invite|invites|contact|contacts|call|calls|email|emails|message|messages|thank|thanks|remind|reminds|keep|keeps|leave|leaves|offer|offers|allow|allows|meet|meets|reach|reaches|join|joins|pass|passes)\s+$/i;

/** True when nothing, or the end of a sentence, comes before: "You", capitalised. */
const startsSentence = (before: string) => !before.trim() || /[.!?:]\s*$/.test(before) || /\n\s*$/.test(before);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One way of naming the person, rewritten to "you" through the text. `loose`
 * ("the owner") is the person wherever it stands; a strict one (a name) only as
 * a possessive, the subject of a verb that cannot be anything else, or the
 * object of a word that makes it one.
 */
function rewrite(text: string, who: string, loose: boolean): string {
  const re = new RegExp(`\\b(?:${who})(?:(['’]s)\\b|((?:\\s+(?:${ADVERBS}))*)(\\s+)([A-Za-z’']+))?`, 'gi');
  return text.replace(re, (whole: string, poss: string | undefined, advs: string | undefined, gap: string | undefined, verb: string | undefined, at: number) => {
    const before = text.slice(0, at);
    const you = startsSentence(before) ? 'You' : 'you';
    if (poss) return startsSentence(before) ? 'Your' : 'your';
    const object = OBJECT_BEFORE.test(before);
    if (verb && !object && (SUBJECT_VERB.test(verb) || (loose && S_VERB.test(verb) && !/(?:ss|us|is)$/.test(verb)))) {
      return `${you}${advs ?? ''}${gap}${youVerb(verb)}`;
    }
    if (loose || object) return `${you}${verb ? `${advs ?? ''}${gap}${verb}` : ''}`;
    return whole;
  });
}

/**
 * Text about the person, said to them. "The owner" always; their first name,
 * where one is given, only where it is plainly them.
 */
export function secondPerson(text: string, name?: string | null): string {
  if (!text) return text;
  let t = rewrite(text, 'the (?:business )?owner', true);
  const first = name?.trim().split(/\s+/)[0];
  if (first && first.length >= 2 && /^[\p{L}’'-]+$/u.test(first)) t = rewrite(t, escape(first), false);
  return t;
}
