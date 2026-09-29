// src/app/api/copilot/money/import/route.ts
// A statement, uploaded. The file is read in memory and dropped; only the rows
// are kept (lib/copilot/money).
//
// CSV and OFX are parsed here and now — the bank wrote those rows, and a few
// thousand of them split in milliseconds — so the response carries the read.
// PDFs and screenshots go to a model, which can take a minute a page, and the
// proxy gives up in under one: the row is written, the reading is handed to
// after(), and the client watches GET /api/copilot/money until it lands —
// the same shape as a plan redraw.
import { after } from 'next/server';
import { todayIso } from '@/lib/copilot/db';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';
import { readImageStatement, readPdfStatement, resolveStatementConfig } from '@/lib/copilot/money/extract';
import { MAX_STATEMENT_BYTES, dateHintFor, parseCsvStatement, parseOfxStatement, sniffFormat } from '@/lib/copilot/money/statement';
import { failImport, finishImport, startImport } from '@/lib/copilot/money/store';
import { getProfile, loadHome } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Uploads a day, per account: a year of statements a month at a time, twice over. */
const UPLOADS_PER_DAY = 30;

/** UTF-8 first; a file full of replacement characters was written in Windows-1252, as many European bank exports are. */
function decode(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const broken = (utf8.match(/�/g) ?? []).length;
  if (broken < 3) return utf8;
  try { return new TextDecoder('windows-1252').decode(bytes); } catch { return utf8; }
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    file = f instanceof File ? f : null;
  } catch {
    return fail('Could not read the upload. Try choosing the file again.');
  }
  if (!file || !file.size) return fail('Choose a statement to upload.');
  if (file.size > MAX_STATEMENT_BYTES) return fail(`That file is ${Math.round(file.size / 1_048_576)} MB. A statement is under ${MAX_STATEMENT_BYTES / 1_048_576} MB — upload one month at a time, or the CSV.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffFormat(bytes.subarray(0, 2048), file.name, file.type);
  if (format === 'spreadsheet') return fail('That is a spreadsheet file. Open it and save it as CSV, or download the CSV from your bank, and upload that.');
  if (!format) return fail('That is not a statement this can read. Upload the CSV or OFX from your bank’s website, a PDF statement, or a screenshot.');
  const method = format === 'pdf' || format === 'image' ? 'read' : 'parsed';
  if (method === 'read' && !resolveStatementConfig()) {
    return fail(`Reading a ${format === 'pdf' ? 'PDF' : 'screenshot'} needs a model, and none is set up on this server. Upload the CSV or OFX from your bank instead — those need nothing.`);
  }

  const rl = await rateLimit(`copilot:statement:${auth.pid}`, UPLOADS_PER_DAY, 86400);
  if (!rl.ok) return fail(`That is today’s ${UPLOADS_PER_DAY} statements. Upload the rest tomorrow.`, 429);

  let started;
  try {
    started = await startImport(auth.pid, { fileName: file.name || 'statement', format, method });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not start reading that statement.', 500);
  }

  if (method === 'parsed') {
    // Parsed now. A file that is not a statement is a failed import with its
    // reason on the row, not a bare error: the sheet shows what was tried.
    try {
      const text = decode(bytes);
      const parsed = format === 'ofx' ? parseOfxStatement(text) : parseCsvStatement(text, { dateHint: dateHintFor(profile.timezone) });
      const done = await finishImport(auth.pid, started.id, { ...parsed, method: 'parsed' });
      return json({ ok: true, import: done, home: await loadHome(auth.pid) });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Could not read that file.';
      await failImport(started.id, reason);
      return json({ ok: false, error: reason, home: await loadHome(auth.pid) });
    }
  }

  const today = todayIso(profile.timezone);
  const mediaType = file.type || 'image/png';
  after(async () => {
    // Never throws: whatever goes wrong is written on the import's row, where the sheet reads it.
    try {
      const reading = format === 'pdf' ? await readPdfStatement(bytes, today) : await readImageStatement(bytes, mediaType, today);
      await finishImport(auth.pid, started.id, { statement: reading.statement, dropped: reading.dropped, method: 'read' });
    } catch (e) {
      await failImport(started.id, e instanceof Error ? e.message : String(e));
    }
  });
  return json({ ok: true, import: started, home: await loadHome(auth.pid) }, 202);
}
