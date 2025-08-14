// src/lib/prospects/seedCsv.ts
import fs from 'fs';
import path from 'path';

export type Prospect = { name: string; email: string; company?: string; source: string };

export function loadSeedCsv(niche: string): Prospect[] {
  const root = process.cwd();
  const csvPath = path.join(root, 'data', 'seeds', `${niche}.csv`);
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header) return [];
  const cols = header.split(',').map((c) => c.trim().toLowerCase());
  const nameIdx = cols.indexOf('name');
  const emailIdx = cols.indexOf('email');
  const companyIdx = cols.indexOf('company');
  const prospects: Prospect[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    const name = parts[nameIdx]?.trim();
    const email = parts[emailIdx]?.trim();
    if (!email) continue;
    prospects.push({
      name: name || email.split('@')[0],
      email,
      company: companyIdx >= 0 ? (parts[companyIdx] || '').trim() : undefined,
      source: `seed:${niche}`
    });
  }
  return prospects;
}


