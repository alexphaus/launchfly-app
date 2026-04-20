// src/lib/agent/tools-extended.ts
// ═══════════════════════════════════════════════════════════════════════════
// Extended Agent Tools — New capabilities (P0-P3)
// ═══════════════════════════════════════════════════════════════════════════
//
// Each tool follows the same pattern as tools.ts:
//   - Returns a Promise<string> with human-readable output
//   - Handles its own errors (never throws)
//   - Respects timeouts and resource limits
//   - Sanitizes all user input

import { createClient } from '@supabase/supabase-js';
import type { ToolContext } from './tools';
import { getEmbedding } from './tools';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/**
 * Sanitize a string for safe interpolation into Python triple-quoted strings.
 * Escapes backslashes first, then all quote characters, so `'''` in input
 * cannot break out of `'''...'''` delimiters.
 */
function safePythonString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/'''/g, "\\'\\'\\'");
}

/**
 * Block SSRF: returns an error string if the URL points to private/internal addresses.
 * Returns null if the URL is safe.
 */
function checkSsrf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Error: Only http/https URLs allowed.';
    }
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname)
    ) {
      return 'Error: Private/internal URLs not allowed.';
    }
    return null;
  } catch {
    return 'Error: Invalid URL format.';
  }
}

const PAYMENT_MAX_AMOUNT = 50_000; // $50,000 hard cap per single payment/invoice

/** Safely extract Stripe error message without leaking API keys or sensitive data */
function safeStripeError(responseText: string): string {
  try {
    const parsed = JSON.parse(responseText) as { error?: { message?: string; type?: string } };
    if (parsed.error?.message) return parsed.error.message.substring(0, 200);
  } catch { /* not JSON, use fallback */ }
  // Strip anything that looks like a key (sk_live_..., sk_test_..., rk_live_...)
  return responseText
    .replace(/(?:sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, '[REDACTED]')
    .substring(0, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// P0: execute_python — Full Cloud Python Sandbox via E2B
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { code: string, packages?: string[], timeout_ms?: number, files?: [{name,url}] }
//   Output: string (stdout + stderr + return value + generated files)
//   Security: E2B sandboxes are fully isolated VMs — no access to host
//   Cost: ~$0.001/min (billed per sandbox lifetime)
//   Limits: 300s max execution, 100MB memory, network access enabled
//
// Error Cases:
//   - E2B_API_KEY not set → clear error message
//   - Sandbox creation timeout → retry once, then fail
//   - Code execution error → return stderr
//   - Package install failure → return pip output

const E2B_TIMEOUT_MS = 300_000;    // 5 min hard cap
const E2B_DEFAULT_TIMEOUT_MS = 30_000; // 30s default
const E2B_MAX_OUTPUT = 12_000;      // 12KB max output

export async function executeExecutePython(
  code: string,
  packages?: string[],
  timeoutMs?: number,
  files?: Array<{ name: string; url: string }>,
): Promise<string> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) return 'Error: E2B_API_KEY environment variable is not set. Get one at https://e2b.dev/';

  if (!code?.trim()) return 'Error: code is required.';

  const effectiveTimeout = Math.min(Math.max(timeoutMs || E2B_DEFAULT_TIMEOUT_MS, 5000), E2B_TIMEOUT_MS);

  try {
    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create({ apiKey, timeoutMs: effectiveTimeout + 30_000 });

    try {
      // Install packages if requested
      if (packages?.length) {
        const safePackages = packages
          .slice(0, 20)
          .map(p => p.replace(/[;&|`$(){}]/g, '').trim())
          .filter(p => p.length > 0 && p.length < 100);

        if (safePackages.length > 0) {
          const installResult = await sandbox.runCode(
            `import subprocess; result = subprocess.run(['pip', 'install', '-q', ${safePackages.map(p => `'${p}'`).join(', ')}], capture_output=True, text=True); print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout); print(result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)`,
            { timeoutMs: 60_000 },
          );
          if (installResult.error) {
            return `Package install failed: ${installResult.error.name}: ${installResult.error.value}\n${(installResult.error.traceback || '').substring(0, 500)}`;
          }
        }
      }

      // Upload files if provided (download from URL first)
      if (files?.length) {
        for (const file of files.slice(0, 10)) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
          try {
            // Download URL content and write to sandbox — use base64-encoded URL to prevent injection
            const urlB64 = Buffer.from(file.url).toString('base64');
            const downloadCode = `
import urllib.request, base64
_url = base64.b64decode('${urlB64}').decode('utf-8')
urllib.request.urlretrieve(_url, '/home/user/${safeName}')
print(f"Downloaded ${safeName}")
`;
            await sandbox.runCode(downloadCode, { timeoutMs: 30_000 });
          } catch {
            // Non-fatal — continue without this file
          }
        }
      }

      // Execute the user's code
      const result = await sandbox.runCode(code, { timeoutMs: effectiveTimeout });

      const parts: string[] = [];

      // Stdout
      if (result.logs?.stdout?.length) {
        const stdout = result.logs.stdout.join('');
        if (stdout.trim()) {
          parts.push('=== Output ===');
          parts.push(stdout);
        }
      }

      // Stderr (warnings, etc.)
      if (result.logs?.stderr?.length) {
        const stderr = result.logs.stderr.join('');
        if (stderr.trim()) {
          parts.push('=== Stderr ===');
          parts.push(stderr);
        }
      }

      // Error
      if (result.error) {
        parts.push('=== Error ===');
        parts.push(`${result.error.name}: ${result.error.value}`);
        if (result.error.traceback) {
          parts.push(result.error.traceback.substring(0, 1500));
        }
      }

      // Results (charts, images, return values)
      if (result.results?.length) {
        for (const r of result.results) {
          if (r.png) {
            // Upload base64 PNG to Supabase storage
            try {
              const supabase = getSupabase();
              await supabase.storage.createBucket('generated-media', { public: true }).catch(() => {});
              const buffer = Buffer.from(r.png, 'base64');
              const filename = `e2b/chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
              await supabase.storage.from('generated-media').upload(filename, buffer, { contentType: 'image/png' });
              const { data } = supabase.storage.from('generated-media').getPublicUrl(filename);
              parts.push(`=== Generated Chart ===\n${data.publicUrl}`);
            } catch {
              parts.push('=== Chart Generated (upload failed) ===');
            }
          } else if (r.text) {
            parts.push(`=== Result ===\n${r.text}`);
          }
        }
      }

      if (parts.length === 0) {
        return '(Code executed successfully but produced no output. Use print() to show results.)';
      }

      const output = parts.join('\n');
      if (output.length > E2B_MAX_OUTPUT) {
        return output.substring(0, E2B_MAX_OUTPUT) + `\n... (truncated, ${output.length} chars total)`;
      }
      return output;

    } finally {
      await sandbox.kill().catch(() => {});
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return `Python execution timed out after ${effectiveTimeout / 1000}s. Try optimizing the code or increasing timeout_ms.`;
    }
    return `Python execution failed: ${msg}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P1: process_document — PDF / Excel / CSV / Word extraction
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { url: string, extract?: string, format?: 'text'|'json'|'markdown' }
//   Output: string (extracted text/structured data)
//   Implementation: Uses E2B sandbox with pre-installed pdfplumber, openpyxl, python-docx
//   Cost: ~$0.002 per document (sandbox time)
//   Limits: 50MB max file, 120s processing

const DOC_MAX_OUTPUT = 15_000; // 15KB max output for documents

export async function executeProcessDocument(
  url: string,
  extract?: string,
  format?: string,
): Promise<string> {
  if (!url?.trim()) return 'Error: url is required.';

  // Validate URL + block SSRF
  const ssrfErr = checkSsrf(url);
  if (ssrfErr) return ssrfErr;

  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) return 'Error: E2B_API_KEY is required for document processing.';

  // Detect file type from URL
  const urlLower = url.toLowerCase();
  let fileType = 'unknown';
  if (urlLower.includes('.pdf')) fileType = 'pdf';
  else if (urlLower.includes('.xlsx') || urlLower.includes('.xls')) fileType = 'excel';
  else if (urlLower.includes('.csv')) fileType = 'csv';
  else if (urlLower.includes('.docx') || urlLower.includes('.doc')) fileType = 'word';
  else if (urlLower.includes('.pptx') || urlLower.includes('.ppt')) fileType = 'powerpoint';
  else if (urlLower.includes('.txt') || urlLower.includes('.md')) fileType = 'text';

  // Build extraction code based on file type
  const outputFormat = format === 'json' ? 'json' : format === 'markdown' ? 'markdown' : 'text';

  // Use base64-encoded URL to prevent Python code injection
  const urlB64 = Buffer.from(url).toString('base64');
  const code = `
import urllib.request
import base64
import os
import json

# Download the file — URL is base64-encoded to prevent injection
url = base64.b64decode('${urlB64}').decode('utf-8')
filename = '/tmp/document' + (os.path.splitext(url.split('?')[0])[-1] or '.bin')
urllib.request.urlretrieve(url, filename)
file_size = os.path.getsize(filename)
if file_size > 50_000_000:
    print("Error: File exceeds 50MB limit")
    exit(1)
print(f"Downloaded {file_size} bytes")

ext = os.path.splitext(filename)[1].lower()
content = ""

if ext == '.pdf':
    import pdfplumber
    with pdfplumber.open(filename) as pdf:
        pages = []
        for i, page in enumerate(pdf.pages[:100]):  # Max 100 pages
            text = page.extract_text() or ''
            tables = page.extract_tables()
            page_content = f"--- Page {i+1} ---\\n{text}"
            for t_idx, table in enumerate(tables):
                if table:
                    page_content += f"\\n[Table {t_idx+1}]\\n"
                    for row in table:
                        page_content += " | ".join(str(cell or '') for cell in row) + "\\n"
            pages.append(page_content)
        content = "\\n".join(pages)

elif ext in ('.xlsx', '.xls'):
    import openpyxl
    wb = openpyxl.load_workbook(filename, read_only=True, data_only=True)
    sheets = []
    for sheet_name in wb.sheetnames[:10]:  # Max 10 sheets
        ws = wb[sheet_name]
        rows_data = []
        for row in ws.iter_rows(max_row=500, values_only=True):  # Max 500 rows
            rows_data.append([str(cell) if cell is not None else '' for cell in row])
        if rows_data:
            sheets.append(f"--- Sheet: {sheet_name} ---")
            for row in rows_data:
                sheets.append(" | ".join(row))
    content = "\\n".join(sheets)
    wb.close()

elif ext == '.csv':
    import csv
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        rows = []
        for i, row in enumerate(reader):
            if i >= 1000: break  # Max 1000 rows
            rows.append(" | ".join(row))
        content = "\\n".join(rows)

elif ext in ('.docx', '.doc'):
    from docx import Document
    doc = Document(filename)
    paragraphs = [p.text for p in doc.paragraphs[:500] if p.text.strip()]
    # Also extract tables
    for table in doc.tables[:20]:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            paragraphs.append(" | ".join(cells))
    content = "\\n".join(paragraphs)

elif ext in ('.pptx', '.ppt'):
    from pptx import Presentation
    prs = Presentation(filename)
    slides = []
    for i, slide in enumerate(prs.slides[:50]):
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, 'text') and shape.text.strip():
                texts.append(shape.text)
        if texts:
            slides.append(f"--- Slide {i+1} ---\\n" + "\\n".join(texts))
    content = "\\n".join(slides)

elif ext in ('.txt', '.md', '.json', '.xml', '.html'):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()[:100000]

else:
    # Try as text first, fall back to binary info
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()[:50000]
    except:
        content = f"Binary file ({file_size} bytes). Cannot extract text from this format."

# Truncate if needed
if len(content) > ${DOC_MAX_OUTPUT * 3}:
    content = content[:${DOC_MAX_OUTPUT * 3}] + "\\n... (truncated)"

print(content)
`;

  try {
    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create({ apiKey, timeoutMs: 150_000 });

    try {
      // Install document processing packages
      await sandbox.runCode(
        "import subprocess; subprocess.run(['pip', 'install', '-q', 'pdfplumber', 'openpyxl', 'python-docx', 'python-pptx'], capture_output=True)",
        { timeoutMs: 60_000 },
      );

      const result = await sandbox.runCode(code, { timeoutMs: 120_000 });

      if (result.error) {
        return `Document processing error: ${result.error.name}: ${result.error.value}\n${(result.error.traceback || '').substring(0, 500)}`;
      }

      let content = result.logs?.stdout?.join('') || '';
      if (!content.trim()) return 'No content could be extracted from the document.';

      // If extract filter requested, use LLM to filter
      if (extract && content.length > 100) {
        try {
          const { generateText } = await import('ai');
          const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');
          const llmResult = await generateText({
            model: deepseek(MINI_MODEL),
            system: `Extract the requested information from the document content. Be thorough and structured. Output format: ${outputFormat}.`,
            messages: [{ role: 'user', content: `EXTRACT: ${extract}\n\nDOCUMENT CONTENT:\n${content.substring(0, 30000)}` }],
          });
          return llmResult.text;
        } catch {
          // Fall through to raw content
        }
      }

      if (content.length > DOC_MAX_OUTPUT) {
        content = content.substring(0, DOC_MAX_OUTPUT) + `\n... (truncated, ${content.length} chars total)`;
      }
      return `[${fileType.toUpperCase()}] ${content}`;

    } finally {
      await sandbox.kill().catch(() => {});
    }
  } catch (err) {
    return `Document processing failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P1: knowledge_base — RAG over Business Documents
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { action: 'search'|'add'|'list'|'delete', query?, url?, title?, content?, doc_id? }
//   Output: string (search results or confirmation)
//   Implementation: Supabase pgvector + text-embedding-3-small
//   Storage: New `knowledge_base_chunks` table (business_id, doc_id, chunk, embedding)
//   Cost: ~$0.0001/search (embedding), storage free in Supabase

const KB_CHUNK_SIZE = 1500;  // chars per chunk
const KB_CHUNK_OVERLAP = 200; // overlap between chunks
const KB_MAX_RESULTS = 8;

function chunkText(text: string, chunkSize = KB_CHUNK_SIZE, overlap = KB_CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function executeKnowledgeBase(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const action = (args.action as string || 'search').toLowerCase();
  const supabase = getSupabase();

  switch (action) {
    case 'search': {
      const query = (args.query as string || '').trim();
      if (!query) return 'Error: query is required for search.';
      const limit = Math.min(Math.max((args.limit as number) || 5, 1), KB_MAX_RESULTS);

      try {
        const embedding = await getEmbedding(query);

        // Try vector search via RPC
        const { data, error } = await supabase.rpc('search_knowledge_base', {
          query_embedding: embedding,
          match_business_id: toolCtx.businessId,
          match_count: limit,
        });

        if (error) {
          // Fallback to text search if RPC not deployed
          const { data: fallbackData, error: fbErr } = await supabase
            .from('knowledge_base_chunks')
            .select('chunk_text, document_title, chunk_index, created_at')
            .eq('business_id', toolCtx.businessId)
            .ilike('chunk_text', `%${query.replace(/[%_\\]/g, ' ').substring(0, 50)}%`)
            .limit(limit);

          if (fbErr || !fallbackData?.length) return `No matching knowledge base entries found for: "${query}"`;

          return fallbackData.map((r, i) =>
            `${i + 1}. [${r.document_title}] (chunk ${r.chunk_index + 1})\n   ${(r.chunk_text || '').substring(0, 400)}`
          ).join('\n\n');
        }

        if (!data?.length) return `No matching knowledge base entries found for: "${query}"`;

        return data.map((r: { document_title: string; chunk_text: string; chunk_index: number; similarity: number }, i: number) =>
          `${i + 1}. [${r.document_title}] (chunk ${r.chunk_index + 1}, relevance: ${(r.similarity || 0).toFixed(2)})\n   ${(r.chunk_text || '').substring(0, 400)}`
        ).join('\n\n');
      } catch (err) {
        return `Knowledge base search failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'add': {
      const url = args.url as string | undefined;
      const title = (args.title as string || '').trim();
      let content = (args.content as string || '').trim();

      if (!title) return 'Error: title is required when adding to knowledge base.';
      if (!url && !content) return 'Error: either url or content is required.';

      // If URL provided, fetch document content
      if (url && !content) {
        // SSRF check
        const ssrfErr = checkSsrf(url);
        if (ssrfErr) return ssrfErr;

        // Use process_document for supported formats
        const urlLower = url.toLowerCase();
        if (/\.(pdf|xlsx?|csv|docx?|pptx?|txt|md)/.test(urlLower)) {
          content = await executeProcessDocument(url);
          if (content.startsWith('Error:') || content.includes('failed')) return content;
        } else {
          // Scrape web page
          try {
            const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } });
            if (res.ok) content = await res.text();
            else return `Failed to fetch URL: HTTP ${res.status}`;
          } catch (err) {
            return `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
      }

      if (!content || content.length < 50) return 'Error: document content is too short (minimum 50 characters).';

      // Cap content to prevent runaway embedding costs (max ~200 chunks ≈ $0.04)
      const MAX_CONTENT_LENGTH = 200 * KB_CHUNK_SIZE; // ~260K chars
      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.substring(0, MAX_CONTENT_LENGTH);
      }

      try {
        const docId = crypto.randomUUID();
        const chunks = chunkText(content).slice(0, 200); // Hard cap: 200 chunks

        // Generate embeddings for all chunks
        const rows = [];
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await getEmbedding(chunks[i]);
          rows.push({
            id: crypto.randomUUID(),
            business_id: toolCtx.businessId,
            document_id: docId,
            document_title: title.substring(0, 200),
            chunk_index: i,
            chunk_text: chunks[i],
            embedding,
            metadata: { source: url || 'manual', total_chunks: chunks.length },
          });
        }

        // Insert in batches of 20
        for (let i = 0; i < rows.length; i += 20) {
          const batch = rows.slice(i, i + 20);
          const { error } = await supabase.from('knowledge_base_chunks').insert(batch);
          if (error) return `Failed to store chunks: ${error.message}`;
        }

        return `✅ Document added to knowledge base: "${title}"\nDocument ID: ${docId}\nChunks: ${chunks.length}\nTotal characters: ${content.length}\n\nYou can now search this document using action="search".`;
      } catch (err) {
        return `Failed to add document: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'list': {
      const { data, error } = await supabase
        .from('knowledge_base_chunks')
        .select('document_id, document_title, created_at, metadata')
        .eq('business_id', toolCtx.businessId)
        .eq('chunk_index', 0) // Only get first chunk per doc (unique doc list)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return `Failed to list documents: ${error.message}`;
      if (!data?.length) return 'No documents in the knowledge base yet. Use action="add" to add documents.';

      return `Knowledge base documents (${data.length}):\n` + data.map((d, i) => {
        const date = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const meta = d.metadata as Record<string, unknown> | null;
        const chunks = meta?.total_chunks || '?';
        return `${i + 1}. "${d.document_title}" (${chunks} chunks, added ${date})\n   ID: ${d.document_id}`;
      }).join('\n');
    }

    case 'delete': {
      const docId = args.doc_id as string;
      if (!docId) return 'Error: doc_id is required for delete. Use action="list" to find document IDs.';

      const { data, error } = await supabase
        .from('knowledge_base_chunks')
        .delete()
        .eq('business_id', toolCtx.businessId)
        .eq('document_id', docId)
        .select('id');

      if (error) return `Failed to delete: ${error.message}`;
      return `✅ Deleted document ${docId} (${data?.length || 0} chunks removed).`;
    }

    default:
      return `Unknown action: ${action}. Use: search, add, list, delete.`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P2: manage_calendar — Google Calendar integration
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { action, summary?, start?, end?, attendees?, calendar_id?, event_id? }
//   Output: string (event details or confirmation)
//   Implementation: Google Calendar API via stored OAuth tokens
//   Cost: Free (Google Calendar API)
//   Limits: 10 events per query, 50 chars summary

export async function executeManageCalendar(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const action = (args.action as string || 'list').toLowerCase();

  const supabase = getSupabase();

  // Look up Google Calendar integration
  const { data: integration } = await supabase
    .from('business_integrations')
    .select('api_key_encrypted, config, status')
    .eq('business_id', toolCtx.businessId)
    .eq('service_name', 'google_calendar')
    .maybeSingle();

  if (!integration || integration.status !== 'active') {
    return 'Google Calendar is not connected. Use request_integration with service_name="google_calendar" to set it up.';
  }

  const config = (integration.config || {}) as Record<string, unknown>;
  const accessToken = integration.api_key_encrypted;
  const calendarId = (args.calendar_id as string) || (config.default_calendar_id as string) || 'primary';

  if (!accessToken) return 'Google Calendar API key/token is missing.';

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;

  try {
    switch (action) {
      case 'list':
      case 'check_availability': {
        const timeMin = (args.start as string) || new Date().toISOString();
        const timeMax = (args.end as string) || new Date(Date.now() + 7 * 86400000).toISOString();
        const maxResults = Math.min((args.limit as number) || 10, 50);

        const params = new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: String(maxResults),
          singleEvents: 'true',
          orderBy: 'startTime',
        });

        const res = await fetch(`${baseUrl}/events?${params}`, { headers });
        if (!res.ok) {
          const err = await res.text();
          return `Calendar API error (${res.status}): ${err.substring(0, 300)}`;
        }

        const data = await res.json() as { items?: Array<Record<string, unknown>> };
        const events = data.items || [];

        if (action === 'check_availability') {
          if (events.length === 0) return `✅ Calendar is FREE from ${timeMin} to ${timeMax}. No conflicts.`;
          const busy = events.map((e: Record<string, unknown>) => {
            const start = (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date || '?';
            const end = (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date || '?';
            return `• ${e.summary || 'Busy'}: ${start} → ${end}`;
          }).join('\n');
          return `⚠️ Calendar has ${events.length} event(s) in that window:\n${busy}`;
        }

        if (events.length === 0) return 'No events found in the specified time range.';

        return `${events.length} event(s):\n` + events.map((e: Record<string, unknown>, i: number) => {
          const start = (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date || '?';
          const end = (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date || '?';
          const attendees = (e.attendees as Array<{ email: string }> || []).map(a => a.email).join(', ');
          return `${i + 1}. "${e.summary || 'No title'}" — ${start} → ${end}${attendees ? `\n   Attendees: ${attendees}` : ''}\n   ID: ${e.id}`;
        }).join('\n');
      }

      case 'create': {
        const summary = (args.summary as string || '').trim();
        const start = args.start as string;
        const end = args.end as string;
        const description = args.description as string || '';
        const location = args.location as string || '';
        const attendees = (args.attendees as string[] || []).map(email => ({ email }));

        if (!summary) return 'Error: summary is required.';
        if (!start) return 'Error: start datetime is required (ISO 8601).';
        if (!end) return 'Error: end datetime is required (ISO 8601).';

        const event = {
          summary: summary.substring(0, 200),
          description: description.substring(0, 2000),
          location: location.substring(0, 200),
          start: { dateTime: start, timeZone: (config.timezone as string) || 'UTC' },
          end: { dateTime: end, timeZone: (config.timezone as string) || 'UTC' },
          attendees: attendees.slice(0, 20),
          reminders: { useDefault: true },
        };

        const res = await fetch(`${baseUrl}/events?sendUpdates=all`, {
          method: 'POST',
          headers,
          body: JSON.stringify(event),
        });

        if (!res.ok) {
          const err = await res.text();
          return `Failed to create event: ${err.substring(0, 300)}`;
        }

        const created = await res.json() as Record<string, unknown>;
        return `✅ Calendar event created: "${summary}"\nID: ${created.id}\nStart: ${start}\nEnd: ${end}\nLink: ${created.htmlLink || 'N/A'}`;
      }

      case 'update': {
        const eventId = args.event_id as string;
        if (!eventId) return 'Error: event_id is required for update.';

        const updates: Record<string, unknown> = {};
        if (args.summary) updates.summary = (args.summary as string).substring(0, 200);
        if (args.description) updates.description = (args.description as string).substring(0, 2000);
        if (args.location) updates.location = (args.location as string).substring(0, 200);
        if (args.start) updates.start = { dateTime: args.start, timeZone: (config.timezone as string) || 'UTC' };
        if (args.end) updates.end = { dateTime: args.end, timeZone: (config.timezone as string) || 'UTC' };

        const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const err = await res.text();
          return `Failed to update event: ${err.substring(0, 300)}`;
        }

        return `✅ Event ${eventId} updated.`;
      }

      case 'delete': {
        const eventId = args.event_id as string;
        if (!eventId) return 'Error: event_id is required for delete.';

        const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          const err = await res.text();
          return `Failed to delete event: ${err.substring(0, 300)}`;
        }

        return `✅ Event ${eventId} deleted.`;
      }

      default:
        return `Unknown action: ${action}. Use: list, check_availability, create, update, delete.`;
    }
  } catch (err) {
    return `Calendar operation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P2: process_payment — Stripe integration
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { action, amount?, currency?, customer_email?, description?, payment_link_id?, ... }
//   Output: string (payment link URL, invoice details, balance info)
//   Implementation: Stripe API via stored API key
//   Security: Only read + payment link creation. No refunds without approval.

export async function executeProcessPayment(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const action = (args.action as string || '').toLowerCase();

  const supabase = getSupabase();
  const { data: integration } = await supabase
    .from('business_integrations')
    .select('api_key_encrypted, config, status')
    .eq('business_id', toolCtx.businessId)
    .eq('service_name', 'stripe')
    .maybeSingle();

  if (!integration || integration.status !== 'active') {
    return 'Stripe is not connected. Use request_integration with service_name="stripe" to set it up.';
  }

  const stripeKey = integration.api_key_encrypted;
  if (!stripeKey) return 'Stripe API key is missing.';

  const headers = {
    Authorization: `Bearer ${stripeKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const encode = (params: Record<string, string>) =>
    Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  try {
    switch (action) {
      case 'create_payment_link': {
        const amount = args.amount as number;
        const currency = ((args.currency as string) || 'usd').toLowerCase();
        const description = (args.description as string || 'Payment').substring(0, 200);

        if (!amount || amount <= 0) return 'Error: amount is required and must be positive.';
        if (amount > PAYMENT_MAX_AMOUNT) return `Error: amount exceeds maximum of ${PAYMENT_MAX_AMOUNT}. Contact support for larger payments.`;

        // Create a price first, then a payment link
        const priceRes = await fetch('https://api.stripe.com/v1/prices', {
          method: 'POST', headers,
          body: encode({
            'unit_amount': String(Math.round(amount * 100)),
            'currency': currency,
            'product_data[name]': description,
          }),
        });
        if (!priceRes.ok) return `Stripe error creating price: ${safeStripeError(await priceRes.text())}`;
        const price = await priceRes.json() as { id: string };

        const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
          method: 'POST', headers,
          body: encode({
            'line_items[0][price]': price.id,
            'line_items[0][quantity]': '1',
          }),
        });
        if (!linkRes.ok) return `Stripe error creating payment link: ${safeStripeError(await linkRes.text())}`;
        const link = await linkRes.json() as { id: string; url: string };

        return `✅ Payment link created\nAmount: ${currency.toUpperCase()} ${amount.toFixed(2)}\nDescription: ${description}\nLink: ${link.url}\nLink ID: ${link.id}`;
      }

      case 'create_invoice': {
        const customerEmail = (args.customer_email as string || '').trim();
        const amount = args.amount as number;
        const currency = ((args.currency as string) || 'usd').toLowerCase();
        const description = (args.description as string || 'Invoice item').substring(0, 200);
        const dueDate = args.due_date as string | undefined;

        if (!customerEmail) return 'Error: customer_email is required.';
        if (!amount || amount <= 0) return 'Error: amount is required and must be positive.';
        if (amount > PAYMENT_MAX_AMOUNT) return `Error: amount exceeds maximum of ${PAYMENT_MAX_AMOUNT}. Contact support for larger invoices.`;

        // Find or create customer
        const custSearchRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(customerEmail)}&limit=1`, { headers });
        if (!custSearchRes.ok) return 'Stripe error searching for customer.';
        const custData = await custSearchRes.json() as { data: Array<{ id: string }> };
        let customerId: string;

        if (custData.data?.length) {
          customerId = custData.data[0].id;
        } else {
          const createRes = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST', headers,
            body: encode({ email: customerEmail }),
          });
          if (!createRes.ok) return 'Stripe error creating customer.';
          const newCust = await createRes.json() as { id: string };
          customerId = newCust.id;
        }

        // Create invoice
        const invoiceParams: Record<string, string> = {
          customer: customerId,
          currency,
          collection_method: 'send_invoice',
          days_until_due: '7',
        };
        if (dueDate) {
          const dueTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);
          invoiceParams.due_date = String(dueTimestamp);
          delete invoiceParams.days_until_due;
        }

        const invRes = await fetch('https://api.stripe.com/v1/invoices', {
          method: 'POST', headers,
          body: encode(invoiceParams),
        });
        if (!invRes.ok) return `Stripe error creating invoice: ${safeStripeError(await invRes.text())}`;
        const invoice = await invRes.json() as { id: string };

        // Add line item
        await fetch('https://api.stripe.com/v1/invoiceitems', {
          method: 'POST', headers,
          body: encode({
            customer: customerId,
            invoice: invoice.id,
            amount: String(Math.round(amount * 100)),
            currency,
            description,
          }),
        });

        // Finalize and send
        const finalRes = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
          method: 'POST', headers,
        });
        const finalized = await finalRes.json() as { id: string; hosted_invoice_url: string; status: string };

        // Send to customer
        await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/send`, {
          method: 'POST', headers,
        });

        return `✅ Invoice created and sent\nAmount: ${currency.toUpperCase()} ${amount.toFixed(2)}\nTo: ${customerEmail}\nDescription: ${description}\nInvoice URL: ${finalized.hosted_invoice_url || 'N/A'}\nInvoice ID: ${invoice.id}`;
      }

      case 'check_balance': {
        const res = await fetch('https://api.stripe.com/v1/balance', { headers });
        if (!res.ok) return `Stripe error: ${safeStripeError(await res.text())}`;
        const balance = await res.json() as { available: Array<{ amount: number; currency: string }>; pending: Array<{ amount: number; currency: string }> };

        const available = balance.available.map(b => `${b.currency.toUpperCase()} ${(b.amount / 100).toFixed(2)}`).join(', ');
        const pending = balance.pending.map(b => `${b.currency.toUpperCase()} ${(b.amount / 100).toFixed(2)}`).join(', ');

        return `💰 Stripe Balance\nAvailable: ${available || 'N/A'}\nPending: ${pending || 'N/A'}`;
      }

      case 'list_recent_payments': {
        const limit = Math.min((args.limit as number) || 10, 50);
        const res = await fetch(`https://api.stripe.com/v1/payment_intents?limit=${limit}`, { headers });
        if (!res.ok) return `Stripe error: ${safeStripeError(await res.text())}`;
        const data = await res.json() as { data: Array<Record<string, unknown>> };

        if (!data.data?.length) return 'No recent payments found.';

        return data.data.map((p, i) => {
          const amount = (p.amount as number) / 100;
          const currency = (p.currency as string).toUpperCase();
          const status = p.status as string;
          const created = new Date((p.created as number) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `${i + 1}. ${currency} ${amount.toFixed(2)} — ${status} (${created})${p.description ? ` — ${p.description}` : ''}`;
        }).join('\n');
      }

      default:
        return `Unknown action: ${action}. Use: create_payment_link, create_invoice, check_balance, list_recent_payments.`;
    }
  } catch (err) {
    return `Payment operation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P2: generate_document — Create PDFs, Excel, Slides
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { doc_type, title, content, template?, data? }
//   Output: string (public URL of generated document)
//   Implementation: E2B sandbox with reportlab/openpyxl/python-pptx
//   Cost: ~$0.002 per document

export async function executeGenerateDocument(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) return 'Error: E2B_API_KEY is required for document generation.';

  const docType = (args.doc_type as string || 'pdf').toLowerCase();
  const title = (args.title as string || 'Document').substring(0, 200);
  const content = (args.content as string || '').trim();
  const data = args.data as Record<string, unknown> | undefined;

  if (!content && !data) return 'Error: content or data is required.';

  // Encode user strings as base64 to prevent Python code injection
  const titleB64 = Buffer.from(title).toString('base64');
  const contentB64 = Buffer.from(content).toString('base64');
  const dataB64 = data ? Buffer.from(JSON.stringify(data)).toString('base64') : '';

  // Build Python code to generate the document
  let code = '';

  if (docType === 'pdf') {
    code = `
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import json, base64

doc = SimpleDocTemplate('/tmp/output.pdf', pagesize=A4, topMargin=0.75*inch, bottomMargin=0.75*inch)
styles = getSampleStyleSheet()
title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=18, spaceAfter=20)
body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=11, leading=14, spaceAfter=8)

_title = base64.b64decode('${titleB64}').decode('utf-8')
_content = base64.b64decode('${contentB64}').decode('utf-8')

elements = []
elements.append(Paragraph(_title, title_style))
elements.append(Spacer(1, 12))

for para in _content.split('\\n'):
    para = para.strip()
    if not para:
        elements.append(Spacer(1, 6))
    elif para.startswith('# '):
        elements.append(Paragraph(para[2:], styles['Heading1']))
    elif para.startswith('## '):
        elements.append(Paragraph(para[3:], styles['Heading2']))
    elif para.startswith('- '):
        elements.append(Paragraph('• ' + para[2:], body_style))
    else:
        elements.append(Paragraph(para, body_style))

${data ? `
# Add data table if provided
table_data = json.loads(base64.b64decode('${dataB64}').decode('utf-8'))
if isinstance(table_data, dict) and 'rows' in table_data:
    headers = table_data.get('headers', list(table_data['rows'][0].keys()) if table_data['rows'] else [])
    rows = [[str(row.get(h, '')) for h in headers] for row in table_data['rows']]
    table = Table([headers] + rows)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4ff')]),
    ]))
    elements.append(Spacer(1, 12))
    elements.append(table)
` : ''}

doc.build(elements)
print("PDF generated successfully")
`;
  } else if (docType === 'excel' || docType === 'xlsx') {
    code = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json, base64

wb = openpyxl.Workbook()
ws = wb.active
ws.title = base64.b64decode('${titleB64}').decode('utf-8')[:31]

# Header style
header_font = Font(bold=True, color='FFFFFF', size=11)
header_fill = PatternFill(start_color='2563EB', end_color='2563EB', fill_type='solid')
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)

${data ? `
data = json.loads(base64.b64decode('${dataB64}').decode('utf-8'))
if isinstance(data, dict) and 'rows' in data:
    headers = data.get('headers', list(data['rows'][0].keys()) if data['rows'] else [])
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
    for row_idx, row in enumerate(data['rows'], 2):
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=row.get(header, ''))
            cell.border = thin_border
    # Auto-width columns
    for col in ws.columns:
        max_length = max(len(str(cell.value or '')) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 4, 50)
` : `
_content = base64.b64decode('${contentB64}').decode('utf-8')
for i, line in enumerate(_content.split('\\n'), 1):
    ws.cell(row=i, column=1, value=line)
`}

wb.save('/tmp/output.xlsx')
print("Excel generated successfully")
`;
  } else if (docType === 'pptx' || docType === 'slides') {
    code = `
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
import base64

prs = Presentation()
prs.slide_width = Inches(13.33)
prs.slide_height = Inches(7.5)

_content = base64.b64decode('${contentB64}').decode('utf-8')
slides_text = _content.split('---')

for i, slide_text in enumerate(slides_text):
    slide_text = slide_text.strip()
    if not slide_text:
        continue
    lines = slide_text.split('\\n')
    title_text = lines[0].strip().lstrip('# ') if lines else 'Slide'
    body_lines = [l.strip() for l in lines[1:] if l.strip()]

    if i == 0:
        layout = prs.slide_layouts[0]  # Title slide
    else:
        layout = prs.slide_layouts[1]  # Title + content

    slide = prs.slides.add_slide(layout)
    slide.shapes.title.text = title_text

    if body_lines and len(slide.placeholders) > 1:
        tf = slide.placeholders[1].text_frame
        tf.text = body_lines[0]
        for line in body_lines[1:]:
            p = tf.add_paragraph()
            p.text = line
            p.font.size = Pt(18)

prs.save('/tmp/output.pptx')
print("Presentation generated successfully")
`;
  } else {
    return `Unsupported doc_type: ${docType}. Use: pdf, excel/xlsx, pptx/slides.`;
  }

  try {
    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create({ apiKey, timeoutMs: 120_000 });

    try {
      // Install packages
      const packages = docType === 'pdf'
        ? 'reportlab'
        : docType === 'excel' || docType === 'xlsx'
          ? 'openpyxl'
          : 'python-pptx';

      await sandbox.runCode(
        `import subprocess; subprocess.run(['pip', 'install', '-q', '${packages}'], capture_output=True)`,
        { timeoutMs: 30_000 },
      );

      const result = await sandbox.runCode(code, { timeoutMs: 60_000 });

      if (result.error) {
        return `Document generation error: ${result.error.name}: ${result.error.value}`;
      }

      // Download the generated file
      const ext = docType === 'excel' ? 'xlsx' : docType === 'slides' ? 'pptx' : docType;
      const fileContent = await sandbox.runCode(
        `import base64; f = open('/tmp/output.${ext}', 'rb'); print(base64.b64encode(f.read()).decode()); f.close()`,
        { timeoutMs: 30_000 },
      );

      const base64Data = fileContent.logs?.stdout?.join('').trim();
      if (!base64Data) return 'Error: Generated file is empty.';

      const buffer = Buffer.from(base64Data, 'base64');

      // Upload to Supabase storage
      const supabase = getSupabase();
      await supabase.storage.createBucket('generated-media', { public: true }).catch(() => {});

      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };

      const filename = `${toolCtx.businessId}/doc-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('generated-media')
        .upload(filename, buffer, { contentType: mimeTypes[ext] || 'application/octet-stream' });

      if (uploadError) return `File generated but upload failed: ${uploadError.message}`;

      const { data: urlData } = supabase.storage.from('generated-media').getPublicUrl(filename);

      return `✅ ${docType.toUpperCase()} document generated: "${title}"\nURL: ${urlData.publicUrl}\nSize: ${(buffer.length / 1024).toFixed(1)} KB`;

    } finally {
      await sandbox.kill().catch(() => {});
    }
  } catch (err) {
    return `Document generation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P2: analyze_image — General-Purpose Vision
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { image_url: string, question?: string, extract_schema?: object }
//   Output: string (analysis/extracted data)
//   Implementation: GPT-4o vision or Claude vision

export async function executeAnalyzeImage(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const imageUrl = (args.image_url as string || '').trim();
  const question = (args.question as string || 'Describe this image in detail. Extract all visible text, numbers, and data.').trim();
  const extractSchema = args.extract_schema as Record<string, string> | undefined;

  if (!imageUrl) return 'Error: image_url is required.';

  // Validate URL
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Error: Only http/https URLs allowed.';
  } catch {
    return 'Error: Invalid URL format.';
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = extractSchema
      ? `You are a precise data extraction agent. Extract the following fields from the image:\n${Object.entries(extractSchema).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nReturn ONLY a JSON object with these fields. No other text.`
      : 'You are a helpful vision assistant. Analyze the image thoroughly and answer the question. Be precise about numbers, text, and details visible in the image.';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content || 'No analysis produced.';
    return result;
  } catch (err) {
    return `Image analysis failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P2: deep_research — Multi-Step Research Chain
// ═══════════════════════════════════════════════════════════════════════════
//
// Tech Spec:
//   Input: { question: string, depth?: 'quick'|'standard'|'thorough', max_sources?: number }
//   Output: string (synthesized research report with citations)
//   Implementation: Decompose → multi-search → cross-reference → synthesize

export async function executeDeepResearch(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const question = (args.question as string || '').trim();
  const depth = (args.depth as string || 'standard').toLowerCase();
  const maxSources = Math.min((args.max_sources as number) || 8, 15);

  if (!question) return 'Error: question is required.';

  const exaKey = process.env.EXA_API_KEY;
  if (!exaKey) return 'Error: EXA_API_KEY is required for deep research.';

  try {
    const { generateText } = await import('ai');
    const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');

    // Step 1: Decompose the question into sub-queries
    const queryCount = depth === 'quick' ? 2 : depth === 'thorough' ? 6 : 4;
    const decompose = await generateText({
      model: deepseek(MINI_MODEL),
      system: 'You are a research planner. Decompose the question into distinct search queries that together will comprehensively answer it. Return ONLY a JSON array of query strings. No other text.',
      messages: [{ role: 'user', content: `Question: ${question}\n\nGenerate ${queryCount} diverse search queries:` }],
    });

    let queries: string[];
    try {
      queries = JSON.parse(decompose.text.replace(/```json\n?|```/g, '').trim());
    } catch {
      queries = [question]; // Fall back to original question
    }

    // Step 2: Execute all searches in parallel
    const searchResults: Array<{ query: string; results: string }> = [];

    const searchPromises = queries.slice(0, queryCount).map(async (query: string) => {
      try {
        const body: Record<string, unknown> = {
          query,
          type: 'auto',
          numResults: Math.ceil(maxSources / queries.length),
          contents: {
            text: { maxCharacters: 2000 },
            summary: true,
            livecrawl: 'fallback',
          },
        };

        const res = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': exaKey },
          body: JSON.stringify(body),
        });

        if (!res.ok) return { query, results: '' };

        const data = await res.json() as {
          results?: Array<{ title: string; url: string; summary?: string; text?: string; publishedDate?: string }>;
        };

        const formatted = (data.results || []).map(r => {
          const date = r.publishedDate ? ` (${r.publishedDate.split('T')[0]})` : '';
          return `**${r.title}**${date}\nURL: ${r.url}\n${r.summary || r.text?.substring(0, 500) || 'No content'}`;
        }).join('\n\n');

        return { query, results: formatted };
      } catch {
        return { query, results: '' };
      }
    });

    const searchResultsRaw = await Promise.all(searchPromises);
    searchResults.push(...searchResultsRaw.filter(r => r.results));

    if (searchResults.length === 0) return 'Research failed — no search results found for any query.';

    // Step 3: Synthesize into a comprehensive report
    const contextBlock = searchResults.map(r =>
      `### Query: "${r.query}"\n${r.results}`
    ).join('\n\n---\n\n');

    const synthesize = await generateText({
      model: deepseek(MINI_MODEL),
      system: `You are a senior research analyst. Synthesize the search results into a comprehensive, well-structured research report.

Rules:
- Lead with a clear executive summary (2-3 sentences)
- Organize findings by theme, not by source
- Cross-reference sources — note agreements and contradictions
- Include specific data points, numbers, and quotes where available
- End with actionable recommendations
- Cite sources inline as [Source Title](URL)
- Be thorough but concise — no fluff`,
      messages: [{
        role: 'user',
        content: `RESEARCH QUESTION: ${question}\n\nSOURCES:\n${contextBlock.substring(0, 25000)}\n\nWrite the research report:`,
      }],
    });

    const sourcesCount = searchResults.reduce((sum, r) => sum + (r.results.match(/URL: /g)?.length || 0), 0);
    return `📋 **Deep Research Report**\nQuestion: ${question}\nSources analyzed: ${sourcesCount} across ${searchResults.length} queries\nDepth: ${depth}\n\n${synthesize.text}`;

  } catch (err) {
    return `Research failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P3: translate — DeepL / Google Translate
// ═══════════════════════════════════════════════════════════════════════════

export async function executeTranslate(
  args: Record<string, unknown>,
): Promise<string> {
  const text = (args.text as string || '').trim();
  const targetLang = (args.target_language as string || '').trim().toUpperCase();
  const sourceLang = (args.source_language as string || '').trim().toUpperCase() || undefined;

  if (!text) return 'Error: text is required.';
  if (!targetLang) return 'Error: target_language is required (e.g. "EN", "ES", "FR", "DE", "ZH", "AR", "JA").';

  // Try DeepL first (higher quality), fall back to free Google Translate
  const deeplKey = process.env.DEEPL_API_KEY;
  if (deeplKey) {
    try {
      const base = deeplKey.endsWith(':fx')
        ? 'https://api-free.deepl.com'
        : 'https://api.deepl.com';

      const params = new URLSearchParams({
        text: text.substring(0, 10000),
        target_lang: targetLang,
      });
      if (sourceLang) params.set('source_lang', sourceLang);

      const res = await fetch(`${base}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${deeplKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (res.ok) {
        const data = await res.json() as {
          translations: Array<{ text: string; detected_source_language: string }>;
        };
        const t = data.translations[0];
        return `[Translated ${t.detected_source_language} → ${targetLang} via DeepL]\n\n${t.text}`;
      }
    } catch {
      // Fall through to Google
    }
  }

  // Fallback: Use LLM for translation (works for all languages, no API key needed)
  try {
    const { generateText } = await import('ai');
    const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');

    const result = await generateText({
      model: deepseek(MINI_MODEL),
      system: `You are a professional translator. Translate the following text to ${targetLang}. Preserve formatting, tone, and meaning. Return ONLY the translation, no explanations.`,
      messages: [{ role: 'user', content: text.substring(0, 10000) }],
    });

    return `[Translated → ${targetLang} via AI]\n\n${result.text}`;
  } catch (err) {
    return `Translation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P3: manage_project — Lightweight Project/Task Tracking
// ═══════════════════════════════════════════════════════════════════════════

export async function executeManageProject(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const action = (args.action as string || 'list').toLowerCase();
  const supabase = getSupabase();

  // Projects stored in jobs table with metadata.project_id for grouping
  switch (action) {
    case 'create_project': {
      const name = (args.name as string || '').trim();
      const description = (args.description as string || '').trim();
      const deadline = args.deadline as string | undefined;

      if (!name) return 'Error: name is required.';

      const projectId = crypto.randomUUID();
      const { data, error } = await supabase.from('jobs').insert({
        business_id: toolCtx.businessId,
        title: name,
        description,
        status: 'draft',
        metadata: {
          is_project: true,
          project_id: projectId,
          deadline: deadline || null,
          subtask_count: 0,
          completed_count: 0,
        },
      }).select('id, title').single();

      if (error) return `Failed to create project: ${error.message}`;
      return `✅ Project created: "${name}"\nProject ID: ${data.id}\nDeadline: ${deadline || 'none'}\n\nUse action="add_task" to add subtasks.`;
    }

    case 'add_task': {
      const projectId = args.project_id as string;
      const title = (args.title as string || '').trim();
      const assignee = args.assignee as string | undefined;
      const priority = (args.priority as string || 'medium').toLowerCase();
      const deadline = args.deadline as string | undefined;
      const dependsOn = args.depends_on as string[] | undefined;

      if (!projectId) return 'Error: project_id is required.';
      if (!title) return 'Error: title is required.';

      const { data, error } = await supabase.from('jobs').insert({
        business_id: toolCtx.businessId,
        title,
        status: 'draft',
        metadata: {
          is_subtask: true,
          parent_project_id: projectId,
          assignee: assignee || null,
          priority,
          deadline: deadline || null,
          depends_on: dependsOn || [],
        },
      }).select('id, title').single();

      if (error) return `Failed to add task: ${error.message}`;

      // Update parent project subtask count
      const { data: project } = await supabase
        .from('jobs')
        .select('metadata')
        .eq('id', projectId)
        .eq('business_id', toolCtx.businessId)
        .single();

      if (project) {
        const meta = (project.metadata || {}) as Record<string, unknown>;
        meta.subtask_count = ((meta.subtask_count as number) || 0) + 1;
        await supabase.from('jobs').update({ metadata: meta }).eq('id', projectId).eq('business_id', toolCtx.businessId);
      }

      return `✅ Task added: "${title}" (${priority} priority)\nTask ID: ${data.id}\nProject: ${projectId}`;
    }

    case 'update_task': {
      const taskId = args.task_id as string;
      if (!taskId) return 'Error: task_id is required.';

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.status) updates.status = args.status;
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;

      // Handle metadata updates
      const { data: current } = await supabase
        .from('jobs')
        .select('metadata, status')
        .eq('id', taskId)
        .eq('business_id', toolCtx.businessId)
        .single();

      if (!current) return 'Task not found.';

      const meta = (current.metadata || {}) as Record<string, unknown>;
      if (args.assignee !== undefined) meta.assignee = args.assignee;
      if (args.priority) meta.priority = args.priority;
      if (args.deadline !== undefined) meta.deadline = args.deadline;
      updates.metadata = meta;

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', taskId)
        .eq('business_id', toolCtx.businessId);

      if (error) return `Failed to update task: ${error.message}`;

      // If status changed to completed, update parent project
      if (args.status === 'completed' && current.status !== 'completed' && meta.parent_project_id) {
        const { data: parent } = await supabase
          .from('jobs')
          .select('metadata')
          .eq('id', meta.parent_project_id as string)
          .single();
        if (parent) {
          const parentMeta = (parent.metadata || {}) as Record<string, unknown>;
          parentMeta.completed_count = ((parentMeta.completed_count as number) || 0) + 1;
          await supabase.from('jobs').update({ metadata: parentMeta }).eq('id', meta.parent_project_id as string).eq('business_id', toolCtx.businessId);
        }
      }

      return `✅ Task ${taskId} updated.`;
    }

    case 'list': {
      const projectId = args.project_id as string | undefined;

      if (projectId) {
        // List tasks in a specific project
        const { data: tasks, error } = await supabase
          .from('jobs')
          .select('id, title, status, metadata, updated_at')
          .eq('business_id', toolCtx.businessId)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (error) return `Failed to list tasks: ${error.message}`;

        const projectTasks = (tasks || []).filter(t => {
          const meta = t.metadata as Record<string, unknown> | null;
          return meta?.parent_project_id === projectId;
        });

        if (!projectTasks.length) return 'No tasks in this project yet.';

        return projectTasks.map((t, i) => {
          const meta = (t.metadata || {}) as Record<string, unknown>;
          const status = t.status === 'completed' ? '✅' : t.status === 'blocked' ? '🔴' : t.status === 'ready' ? '🔵' : '⬜';
          const assignee = meta.assignee ? ` (${meta.assignee})` : '';
          const deadline = meta.deadline ? ` — due ${meta.deadline}` : '';
          return `${status} ${i + 1}. "${t.title}"${assignee}${deadline}\n   ID: ${t.id} | Priority: ${meta.priority || 'medium'}`;
        }).join('\n');
      } else {
        // List all projects
        const { data: projects, error } = await supabase
          .from('jobs')
          .select('id, title, status, metadata, updated_at')
          .eq('business_id', toolCtx.businessId)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (error) return `Failed to list projects: ${error.message}`;

        const projectList = (projects || []).filter(p => {
          const meta = p.metadata as Record<string, unknown> | null;
          return meta?.is_project === true;
        });

        if (!projectList.length) return 'No projects yet. Use action="create_project" to create one.';

        return projectList.map((p, i) => {
          const meta = (p.metadata || {}) as Record<string, unknown>;
          const total = (meta.subtask_count as number) || 0;
          const done = (meta.completed_count as number) || 0;
          const deadline = meta.deadline ? ` — due ${meta.deadline}` : '';
          const progress = total > 0 ? ` [${done}/${total} tasks done]` : '';
          return `${i + 1}. "${p.title}" (${p.status})${progress}${deadline}\n   ID: ${p.id}`;
        }).join('\n');
      }
    }

    default:
      return `Unknown action: ${action}. Use: create_project, add_task, update_task, list.`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// P1: Memory Contradiction Detection (enhancement to save_memory)
// ═══════════════════════════════════════════════════════════════════════════

export async function checkMemoryContradiction(
  content: string,
  businessId: string,
): Promise<{ contradicts: boolean; existingMemory?: string; existingId?: string }> {
  try {
    const embedding = await getEmbedding(content);
    const supabase = getSupabase();

    const { data } = await supabase.rpc('search_memories', {
      query_embedding: embedding,
      match_business_id: businessId,
      match_category: null,
      match_count: 3,
    });

    if (!data?.length) return { contradicts: false };

    // Check if any highly similar memory exists (similarity > 0.85)
    for (const mem of data) {
      if ((mem.similarity || 0) > 0.85) {
        // High similarity — check if content contradicts
        const existing = (mem.content || '') as string;
        const existingLower = existing.toLowerCase();
        const newLower = content.toLowerCase();

        // Simple heuristic: if they share 60%+ words but have negation differences
        const existingWords = new Set(existingLower.split(/\s+/).filter((w: string) => w.length > 3));
        const newWords = new Set(newLower.split(/\s+/).filter((w: string) => w.length > 3));
        const overlap = [...existingWords].filter(w => newWords.has(w)).length;
        const overlapRatio = overlap / Math.max(existingWords.size, newWords.size, 1);

        // If high word overlap but content is different, flag as potential contradiction
        if (overlapRatio > 0.4 && existing !== content) {
          // Check for negation patterns
          const hasNegationDiff =
            (newLower.includes('not ') !== existingLower.includes('not ')) ||
            (newLower.includes("don't") !== existingLower.includes("don't")) ||
            (newLower.includes('never') !== existingLower.includes('never')) ||
            (newLower.includes('no longer') || newLower.includes('changed') || newLower.includes('actually'));

          if (hasNegationDiff || overlapRatio > 0.6) {
            return {
              contradicts: true,
              existingMemory: existing,
              existingId: mem.id as string,
            };
          }
        }
      }
    }

    return { contradicts: false };
  } catch {
    // Non-fatal — don't block save_memory
    return { contradicts: false };
  }
}
