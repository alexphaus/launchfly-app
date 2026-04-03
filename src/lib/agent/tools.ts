// src/lib/agent/tools.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Tool Definitions — OpenAI Function Calling tools
// ═══════════════════════════════════════════════════════════════════════════
//
// Each tool has:
//  1. A JSON schema (for OpenAI function calling)
//  2. An execute() handler that runs the tool and returns a string result

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Tool JSON Schemas (for OpenAI) ─────────────────────────────────────

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description: 'Search the web for information. Returns top results with titles, URLs, and snippets. Use for market research, finding leads, trending topics, competitor analysis.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'scrape_page',
      description: 'Fetch and extract clean text content from a URL. Use after search_web to read a specific page in detail.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape' },
          extract: { type: 'string', description: 'What specific information to extract (optional — if blank, returns full text)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_google_maps',
      description: 'Search Google Maps for local businesses. Returns name, phone, rating, reviews, address, website. Use for lead generation and competitor research.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Business type (e.g. "plumber", "restaurant")' },
          location: { type: 'string', description: 'City, state or area (e.g. "Kuala Lumpur", "Austin, TX")' },
          maxResults: { type: 'number', description: 'Max results to return (default 10, max 50)' },
        },
        required: ['query', 'location'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_leads',
      description: 'Save one or more leads to the business CRM database (hunter_prospects table). Use after search_google_maps or manual research.',
      parameters: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Business/person name' },
                phone: { type: 'string', description: 'Phone number (with country code)' },
                email: { type: 'string', description: 'Email address (optional)' },
                website: { type: 'string', description: 'Website URL (optional)' },
                address: { type: 'string', description: 'Address (optional)' },
                category: { type: 'string', description: 'Business category (optional)' },
                notes: { type: 'string', description: 'Extra context (optional)' },
              },
              required: ['name', 'phone'],
            },
            description: 'Array of leads to save',
          },
        },
        required: ['leads'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_report',
      description: 'Send a formatted message/report to the business owner via WhatsApp. Use to deliver results, ask for approval, or provide updates.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message to send to the business owner' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_database',
      description: 'Query the business database for analytics. Can query customers, leads, bookings, conversations. Use for generating insights and reports.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['customers', 'hunter_prospects', 'quote_leads', 'chat_history', 'bookings'],
            description: 'Which table to query',
          },
          filters: {
            type: 'object',
            description: 'Key-value filters to apply (column: value)',
          },
          limit: { type: 'number', description: 'Max rows to return (default 25)' },
          select: { type: 'string', description: 'Columns to select (comma-separated, default *)' },
        },
        required: ['table'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'draft_content',
      description: 'Use AI to draft content: social media posts, email campaigns, video scripts, ad copy, blog articles. Provide type and topic.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['social_post', 'email', 'video_script', 'ad_copy', 'blog', 'sms', 'whatsapp_template'],
            description: 'Type of content to generate',
          },
          topic: { type: 'string', description: 'Topic, angle, or specific instructions for the content' },
          platform: { type: 'string', description: 'Target platform (instagram, facebook, tiktok, linkedin, email)' },
        },
        required: ['type', 'topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weather_forecast',
      description: 'Get the 14-day weather forecast for a specific city or location (returns dates, emojis, and min/max temperatures). Use this to add weather context to local events.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name (e.g. "Madrid", "Los Alcázares")' },
        },
        required: ['location'],
      },
    },
  },
];

// ─── Tool Execution Handlers ─────────────────────────────────────────────

export interface ToolContext {
  businessId: string;
  businessName?: string;
  ownerPhone?: string;
  assistantName?: string;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  switch (name) {
    case 'search_web':
      return executeSearchWeb(args.query as string);

    case 'scrape_page':
      return executeScrapePage(args.url as string, args.extract as string | undefined);

    case 'search_google_maps':
      return executeSearchGoogleMaps(
        args.query as string,
        args.location as string,
        (args.maxResults as number) || 10,
        toolCtx.businessId,
      );

    case 'save_leads':
      return executeSaveLeads(args.leads as Array<Record<string, string>>, toolCtx.businessId);

    case 'send_report':
      return executeSendReport(args.message as string, toolCtx);

    case 'query_database':
      return executeQueryDatabase(
        args.table as string,
        args.filters as Record<string, unknown> | undefined,
        (args.limit as number) || 25,
        (args.select as string) || '*',
        toolCtx.businessId,
      );

    case 'draft_content':
      return executeDraftContent(
        args.type as string,
        args.topic as string,
        args.platform as string | undefined,
        toolCtx,
      );

    case 'get_weather_forecast':
      return executeGetWeatherForecast(args.location as string);

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── search_web (via Jina Reader / Tavily) ───────────────────────────────

async function executeSearchWeb(query: string): Promise<string> {
  // Try Tavily first (structured search results), fall back to Jina
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: 8,
          include_answer: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          answer?: string;
          results?: { title: string; url: string; content: string }[];
        };
        let output = '';
        if (data.answer) output += `**Summary:** ${data.answer}\n\n`;
        for (const r of data.results || []) {
          output += `- **${r.title}** (${r.url})\n  ${r.content?.substring(0, 300)}\n`;
        }
        return output || 'No results found.';
      }
    } catch (err) {
      console.warn('[agent:search_web] Tavily failed, trying Jina:', err);
    }
  }

  // Fallback: Jina Reader search endpoint
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json', 'X-Return-Format': 'text' },
    });
    if (res.ok) {
      const text = await res.text();
      return text.substring(0, 5000) || 'No results found.';
    }
  } catch (err) {
    console.warn('[agent:search_web] Jina failed:', err);
  }

  return 'Search failed — no API keys configured. Set TAVILY_API_KEY in your environment.';
}

// ─── scrape_page (via Jina Reader) ───────────────────────────────────────

async function executeScrapePage(url: string, extract?: string): Promise<string> {
  // Validate URL to prevent SSRF
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Error: Only http/https URLs allowed';
    }
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
      return 'Error: Private/internal URLs not allowed';
    }
  } catch {
    return 'Error: Invalid URL format';
  }

  try {
    // Jina Reader: prefix URL with r.jina.ai to get clean markdown
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return `Scrape failed: HTTP ${res.status}`;

    const text = await res.text();
    const content = text.substring(0, 40000);

    // If extract instruction provided, use AI to pull specific data
    if (extract) {
      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: 'Extract the requested information from the scraped content. Be concise and structured.',
        messages: [{ role: 'user', content: `EXTRACT: ${extract}\n\nCONTENT:\n${content}` }],
      });
      return result.text;
    }

    return content;
  } catch (err) {
    return `Scrape error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── search_google_maps (via Apify) ──────────────────────────────────────

async function executeSearchGoogleMaps(
  query: string,
  location: string,
  maxResults: number,
  businessId: string,
): Promise<string> {
  try {
    const { searchGoogleMaps } = await import('@/lib/apify');
    const leads = await searchGoogleMaps({
      query,
      location,
      maxResults: Math.min(maxResults, 50),
      businessId,
    });

    if (!leads.length) return 'No businesses found on Google Maps for that query.';

    let output = `Found ${leads.length} businesses:\n\n`;
    for (const l of leads) {
      output += `- **${l.title}** | ${l.phone || 'No phone'} | ⭐${l.rating || 'N/A'} (${l.reviewsCount || 0} reviews)\n`;
      if (l.address) output += `  📍 ${l.address}\n`;
      if (l.website) output += `  🌐 ${l.website}\n`;
      output += '\n';
    }
    return output;
  } catch (err) {
    return `Google Maps search failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── save_leads ──────────────────────────────────────────────────────────

async function executeSaveLeads(
  leads: Array<Record<string, string>>,
  businessId: string,
): Promise<string> {
  if (!leads?.length) return 'No leads provided.';

  const supabase = getSupabase();
  let saved = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.phone) { skipped++; continue; }

    // Normalize phone: strip everything except digits and leading +
    let phone = lead.phone.replace(/[^\d+]/g, '');
    // Remove duplicate + signs, ensure at most one leading +
    phone = phone.replace(/^\++/, '+').replace(/(?!^)\+/g, '');
    if (!phone || phone.length < 7) { skipped++; continue; }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('hunter_prospects')
      .select('id')
      .eq('business_id', businessId)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { error } = await supabase.from('hunter_prospects').insert({
      business_id: businessId,
      phone,
      name: lead.name || 'Unknown',
      email: lead.email || null,
      website: lead.website || null,
      address: lead.address || null,
      category: lead.category || null,
      notes: lead.notes || null,
      status: 'new',
      source: 'agent_task',
    });

    if (error) {
      console.warn(`[agent:save_leads] Insert error for ${phone}:`, error.message);
      skipped++;
    } else {
      saved++;
    }
  }

  return `Saved ${saved} leads to CRM. Skipped ${skipped} (duplicates or missing phone).`;
}

// ─── send_report ─────────────────────────────────────────────────────────

async function executeSendReport(
  message: string,
  toolCtx: ToolContext,
): Promise<string> {
  if (!toolCtx.ownerPhone) return 'Cannot send report — owner phone number not configured.';

  try {
    const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
    const provider = await getWhatsAppProvider(toolCtx.businessId);

    await provider.sendWhatsApp(
      toolCtx.ownerPhone,
      `🤖 *Agent Report${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}*\n\n${message}`,
      toolCtx.businessId,
    );
    return 'Report sent to business owner via WhatsApp.';
  } catch (err) {
    return `Failed to send report: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── query_database ──────────────────────────────────────────────────────

const ALLOWED_TABLES = new Set(['customers', 'hunter_prospects', 'quote_leads', 'chat_history', 'bookings']);

// Only allow simple column names in select (no subqueries, no functions)
function sanitizeSelect(select: string): string {
  if (!select || select === '*') return '*';
  // Split by comma, keep only valid column names (letters, digits, underscores)
  const cols = select.split(',').map(c => c.trim()).filter(c => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));
  return cols.length > 0 ? cols.join(',') : '*';
}

async function executeQueryDatabase(
  table: string,
  filters: Record<string, unknown> | undefined,
  limit: number,
  select: string,
  businessId: string,
): Promise<string> {
  if (!ALLOWED_TABLES.has(table)) return `Table "${table}" not allowed. Use: ${[...ALLOWED_TABLES].join(', ')}`;

  const supabase = getSupabase();

  let query = supabase.from(table).select(sanitizeSelect(select)).eq('business_id', businessId);

  // Apply safe filters
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      // Only allow simple equality filters — prevent injection
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query.limit(Math.min(limit, 100)).order('created_at', { ascending: false });

  if (error) return `Query error: ${error.message}`;
  if (!data?.length) return `No results in ${table} matching those filters.`;

  return `${data.length} rows:\n${JSON.stringify(data, null, 2).substring(0, 6000)}`;
}

// ─── draft_content ───────────────────────────────────────────────────────

async function executeDraftContent(
  type: string,
  topic: string,
  platform: string | undefined,
  toolCtx: ToolContext,
): Promise<string> {
  const { generateText } = await import('ai');
  const { openai } = await import('@ai-sdk/openai');

  const systemPrompt = `You are a world-class content creator for ${toolCtx.businessName || 'a service business'}.
Create compelling ${type} content that drives engagement, leads, and sales.
${platform ? `Target platform: ${platform}. Optimize format, length, and style for ${platform}.` : ''}
Include relevant hashtags for social posts. Include a CTA.
Keep it authentic, not corporate. Match the tone of a confident, helpful expert.`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: [{ role: 'user', content: `Create ${type} about: ${topic}` }],
  });

  return result.text;
}

// ─── get_weather_forecast ────────────────────────────────────────────────

function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '🌤️';
}

async function executeGetWeatherForecast(location: string): Promise<string> {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return `Could not find map coordinates for ${location}`;

    const loc = geoData.results[0];
    const lat = loc.latitude;
    const lon = loc.longitude;

    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=14`);
    const wData = await wRes.json();
    if (!wData.daily) return `No weather data available for ${location}`;

    const times = wData.daily.time; // array of "YYYY-MM-DD"
    const codes = wData.daily.weather_code;
    const max = wData.daily.temperature_2m_max;
    const min = wData.daily.temperature_2m_min;

    let forecast = `14-day Weather for ${loc.name} (${loc.admin1 || loc.country}):\n`;
    for(let i = 0; i < times.length; i++){
       forecast += `${times[i]}: ${getWeatherEmoji(codes[i])} ${Math.round(max[i])}°C / ${Math.round(min[i])}°C\n`;
    }
    return forecast;
  } catch (err) {
    return `Failed to fetch weather: ${err instanceof Error ? err.message : String(err)}`;
  }
}
