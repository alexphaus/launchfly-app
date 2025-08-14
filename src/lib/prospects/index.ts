// src/lib/prospects/index.ts
import { loadSeedCsv, type Prospect } from './seedCsv';

export async function getProspects(niche: string): Promise<Prospect[]> {
  const fromSeed = loadSeedCsv(niche);
  if (fromSeed.length > 0) return fromSeed;
  return [];
}


