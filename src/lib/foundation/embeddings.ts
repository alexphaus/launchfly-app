// src/lib/foundation/embeddings.ts
// ═══════════════════════════════════════════════════════════════════════════
// Embeddings for semantic matching.
//
// Same model and dimensionality as the rest of the codebase
// (text-embedding-3-small / 1536) so Foundation vectors stay comparable with
// ai_memories and the agent's skill search.
// ═══════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHARS = 8000;

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Returns null (rather than throwing) when embeddings are unavailable —
 *  the scorer degrades to explicit skill tags, it does not break. */
export async function embed(text: string): Promise<number[] | null> {
  const openai = getClient();
  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (!openai || !cleaned) return null;
  try {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: cleaned });
    return res.data[0].embedding;
  } catch (err) {
    console.warn('[foundation] embedding failed:', (err as Error).message);
    return null;
  }
}

/** Batch variant — one API call for many texts, order preserved. */
export async function embedMany(texts: string[]): Promise<Array<number[] | null>> {
  const openai = getClient();
  const cleaned = texts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS));
  if (!openai || cleaned.every((t) => !t)) return texts.map(() => null);
  try {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: cleaned });
    return cleaned.map((_, i) => res.data[i]?.embedding ?? null);
  } catch (err) {
    console.warn('[foundation] batch embedding failed:', (err as Error).message);
    return texts.map(() => null);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** The text that represents an operator for matching purposes. */
export function operatorEmbeddingText(args: {
  headline?: string | null;
  positioning?: string | null;
  skills: Array<{ label: string; proficiency: number }>;
}): string {
  const strong = args.skills
    .filter((s) => s.proficiency >= 40)
    .sort((a, b) => b.proficiency - a.proficiency)
    .map((s) => s.label);
  return [args.headline, args.positioning, strong.length ? `Skills: ${strong.join(', ')}` : '']
    .filter(Boolean)
    .join('\n');
}

/** The text that represents an opportunity for matching purposes. */
export function opportunityEmbeddingText(args: {
  title: string;
  summary?: string | null;
  body?: string | null;
  required_skills?: string[];
}): string {
  return [
    args.title,
    args.summary,
    args.body,
    args.required_skills?.length ? `Requires: ${args.required_skills.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
