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

// ─── Tool Availability ──────────────────────────────────────────────────
// Tools tagged 'core' are available to all agents.
// Tools tagged 'internal' are only available when explicitly enabled.
// Pass enabledTools=['save_leads','search_google_maps'] to opt-in.

const CORE_TOOLS = new Set([
  'search_web', 'scrape_page', 'send_report',
  'query_database', 'draft_content', 'get_weather_forecast',
  'search_memory', 'save_memory',
]);
const INTERNAL_TOOLS = new Set(['save_leads', 'search_google_maps', 'send_whatsapp', 'manage_job', 'delegate_task', 'delegate_task_and_wait', 'request_approval', 'analyze_inventory']);

/**
 * Return the tool schemas to pass to the model.
 * - If enabledTools is provided, core tools + only the listed internal tools are included.
 * - If enabledTools is undefined/null, ALL tools are included (backwards compat for Launchfly).
 */
export function getToolsForAgent(enabledTools?: string[] | null) {
  if (!enabledTools) return AGENT_TOOLS; // legacy: all tools
  const extras = new Set(enabledTools);
  return AGENT_TOOLS.filter(t => {
    const name = t.function.name;
    return CORE_TOOLS.has(name) || extras.has(name);
  });
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
      description: 'Fetch and extract clean text content from a URL. Use after search_web to read a specific page in detail. Always provide the "extract" parameter when scraping listing/calendar pages to ensure ALL entries in the target date range are returned. Never invent or guess data not present in the scraped content.',
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
      description: 'Send a formatted message/report to the business owner via WhatsApp. THIS is the ONLY way to communicate or send a report to the owner. DO NOT summarize that you completed a report, you MUST put the actual full report text inside the "message" parameter, formatted exactly as requested by the user. You can attach an image URL to make the report richer.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message to send to the business owner' },
          imageUrl: { type: 'string', description: 'Optional secure HTTPS URL of an image (e.g. graph, trending product photo) to attach to the report.' },
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
            enum: ['customers', 'hunter_prospects', 'quote_leads', 'chat_history', 'bookings', 'jobs', 'suppliers'],
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
  {
    type: 'function' as const,
    function: {
      name: 'send_whatsapp',
      description: 'Send a WhatsApp message to any phone number (supplier, employee, partner). Use this to contact suppliers with quote requests, send job updates to technicians, etc.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number with country code (e.g. "+34612345678")' },
          message: { type: 'string', description: 'The message to send' },
          imageUrl: { type: 'string', description: 'Optional secure HTTPS URL of an image to attach to the message (e.g. materials, job site photo).' },
        },
        required: ['phone', 'message'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'delegate_task',
      description: 'Delegate a specific task to another AI assistant (e.g. Marketing OS, Purchasing OS). Use this when the request requires specialized back-office capabilities. Do not wait for them to finish, just dispatch and then use send_report to the owner.',
      parameters: {
        type: 'object',
        properties: {
          assistantConfigName: { type: 'string', description: 'The exact name of the assistant config in the database (e.g. "Purchasing OS", "Marketing OS")' },
          instruction: { type: 'string', description: 'A detailed prompt describing what the sub-agent needs to accomplish.' },
        },
        required: ['assistantConfigName', 'instruction'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'manage_job',
      description: 'Create or update a job/purchase order in the jobs table. Use to log new jobs from scope extraction, update status (draft/quoting/ready/blocked/completed), add materials, record quotes, or flag blockers.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update'], description: 'Create a new job or update an existing one' },
          jobId: { type: 'string', description: 'Job ID (required for update)' },
          title: { type: 'string', description: 'Job title/name (e.g. "Smith HVAC repair")' },
          status: { type: 'string', enum: ['draft', 'quoting', 'ready', 'blocked', 'completed'], description: 'Job status' },
          description: { type: 'string', description: 'Raw description or scope of work' },
          materials_needed: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                qty: { type: 'number' },
                unit: { type: 'string' },
              },
              required: ['item'],
            },
            description: 'List of materials needed',
          },
          blockers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of blockers preventing job from starting',
          },
          metadata: { type: 'object', description: 'Extra data: job_date, address, technician, client_name, etc.' },
        },
        required: ['action'],
      },
    },
  },
    {
      type: 'function' as const,
      function: {
        name: 'analyze_inventory',
        description: 'Analyze a photo of current inventory/stall/van/shelf and compare it against the saved golden-state (fully stocked) reference photo. Identifies missing and low-stock items and drafts a purchase order. Can also save a new golden-state reference image or analyze a single image without comparison.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['compare', 'set_golden', 'analyze', 'list_golden'], description: 'compare: diff current vs golden. set_golden: save a new reference photo. analyze: describe a single image. list_golden: list saved reference photos.' },
            imageUrl: { type: 'string', description: 'URL of the image to analyze or save as golden state.' },
            label: { type: 'string', description: 'Label for the golden state image (e.g. "Market stall - jewelry section")' },
            category: { type: 'string', description: 'Category: stall, van, shelf, expositor, workshop, etc.' },
            goldenImageId: { type: 'string', description: 'Specific golden state image ID to compare against. If omitted, uses the most recent one.' },
          },
          required: ['action'],
        },
      },
    },
  // ── Await-able Delegation ──────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'delegate_task_and_wait',
      description: 'Delegate a task to another AI assistant AND pause until it completes. When the sub-agent finishes, your task will automatically resume with its results. Use this when you NEED the result before continuing (e.g. "get quotes then compare").',
      parameters: {
        type: 'object',
        properties: {
          assistantConfigName: { type: 'string', description: 'The exact assistant name (e.g. "Purchasing OS", "Marketing OS")' },
          instruction: { type: 'string', description: 'Detailed prompt for the sub-agent' },
        },
        required: ['assistantConfigName', 'instruction'],
      },
    },
  },
  // ── Approval Gate ──────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'request_approval',
      description: 'Ask the business owner for approval before proceeding with a significant action (e.g. placing an order, sending a campaign, spending money). Sends a WhatsApp message and PAUSES your task until the owner replies. Your task will resume automatically with their response.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The approval question to ask the owner. Be specific about what you want to do and the cost/impact.' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Suggested response options (e.g. ["Approve", "Reject", "Modify"]). Owner can also reply freely.',
          },
        },
        required: ['question'],
      },
    },
  },
  // ── Semantic Memory ────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'search_memory',
      description: 'Search the AI memory for past learnings, decisions, patterns, and supplier info relevant to a query. Uses semantic (meaning-based) search. Use this before making decisions to check if you already know something useful.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query (e.g. "best silver supplier", "owner prefers organic materials")' },
          category: { type: 'string', description: 'Optional category filter: supplier, decision, pattern, preference, market_insight' },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Save an important insight, decision, or learning to long-term memory. The AI will remember this across future conversations. Use for: supplier reliability notes, owner preferences, pricing patterns, market insights, what worked/failed.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The insight or fact to remember (be specific and concise)' },
          category: { type: 'string', enum: ['supplier', 'decision', 'pattern', 'preference', 'market_insight', 'general'], description: 'Memory category' },
          importance: { type: 'number', description: 'Importance score 0.0-1.0 (default 0.5). Use 0.8+ for critical business decisions.' },
        },
        required: ['content', 'category'],
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
  taskId?: string; // Current agent task ID (needed for approval/delegation pause)
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
      return executeSendReport(args.message as string, toolCtx, args.imageUrl as string | undefined);

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

    case 'send_whatsapp':
      return executeSendWhatsApp(args.phone as string, args.message as string, toolCtx, args.imageUrl as string | undefined);


    case 'delegate_task':
      return executeDelegateTask(args.assistantConfigName as string, args.instruction as string, toolCtx);

    case 'manage_job':
      return executeManageJob(args as Record<string, unknown>, toolCtx.businessId);

    case 'analyze_inventory':
      return executeAnalyzeInventory(args as Record<string, unknown>, toolCtx);

    case 'delegate_task_and_wait':
      return executeDelegateTaskAndWait(args.assistantConfigName as string, args.instruction as string, toolCtx);

    case 'request_approval':
      return executeRequestApproval(args.question as string, args.options as string[] | undefined, toolCtx);

    case 'search_memory':
      return executeSearchMemory(args.query as string, toolCtx.businessId, args.category as string | undefined, (args.limit as number) || 5);

    case 'save_memory':
      return executeSaveMemory(args.content as string, args.category as string, toolCtx.businessId, (args.importance as number) || 0.5);

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
    // Use a larger limit so paginated listing pages (e.g. medieval market calendars)
    // are not truncated mid-list, which causes the agent to hallucinate missing entries.
    const content = text.substring(0, 40000);

    // If extract instruction provided, use AI to pull specific data
    if (extract) {
      const { generateText } = await import('ai');
      const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');
      const result = await generateText({
        model: deepseek(MINI_MODEL),
        system: 'Extract the requested information from the scraped content. Be concise and structured. Include ALL matching items — do not truncate or summarize the list.',
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
  imageUrl?: string,
): Promise<string> {
  if (!toolCtx.ownerPhone) return 'Cannot send report — owner phone number not configured.';

  try {
    // Reports go VIA the Launchfly central number (CEO assistant),
    // NOT through the business's own WhatsApp instance.
    // The business instance is for customer/supplier comms.
    const launchflyInstance = process.env.LAUNCHFLY_INSTANCE_NAME;
    let provider;

    if (launchflyInstance) {
      // Use the dedicated Launchfly Evolution instance
      const evo = await import('@/lib/evolution');
      const baseUrl = process.env.EVOLUTION_BASE_URL!;
      const apiKey = process.env.EVOLUTION_API_KEY!;
      const creds = { baseUrl, apiKey, instanceName: launchflyInstance };

      provider = {
        sendWhatsApp: async (to: string, body: string) => {
          return evo.sendWhatsAppWithCreds(to, body, creds);
        },
        sendImage: async (to: string, imgUrl: string, caption?: string) => {
          return evo.sendImageWithCreds(to, imgUrl, creds, caption);
        },
      };
    } else {
      // Fallback: use the business provider (may not work if business instance = owner phone)
      const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
      provider = await getWhatsAppProvider(toolCtx.businessId);
    }

    const fullMessage = `🤖 *Agent Report${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}*\n\n${message}`;

    let result;
    if (imageUrl) {
      result = await provider.sendImage(
        toolCtx.ownerPhone,
        imageUrl,
        fullMessage,
        toolCtx.businessId,
      );
    } else {
      result = await provider.sendWhatsApp(
        toolCtx.ownerPhone,
        fullMessage,
        toolCtx.businessId,
      );
    }

    if (!result.sent) {
      return `Failed to send report: ${result.error || 'Unknown WhatsApp error'}`;
    }

    // Save outbound report to chat history so the agent remembers it later
    try {
      const { saveMessage } = await import('@/lib/ai-receptionist/history');
      await saveMessage(toolCtx.ownerPhone, 'assistant', fullMessage, toolCtx.businessId);
    } catch (e) {
      console.warn('Failed to save outbound report to chat history:', e);
    }

    return 'Report sent to business owner via WhatsApp.';
  } catch (err) {
    return `Failed to send report: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── query_database ──────────────────────────────────────────────────────

const ALLOWED_TABLES = new Set(['customers', 'hunter_prospects', 'quote_leads', 'chat_history', 'bookings', 'jobs', 'suppliers']);

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
  const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');

  const systemPrompt = `You are a world-class content creator for ${toolCtx.businessName || 'a service business'}.
Create compelling ${type} content that drives engagement, leads, and sales.
${platform ? `Target platform: ${platform}. Optimize format, length, and style for ${platform}.` : ''}
Include relevant hashtags for social posts. Include a CTA.
Keep it authentic, not corporate. Match the tone of a confident, helpful expert.`;

  const result = await generateText({
    model: deepseek(MINI_MODEL),
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

// ─── send_whatsapp (message any phone via business instance) ─────────────

async function executeSendWhatsApp(
  phone: string,
  message: string,
  toolCtx: ToolContext,
  imageUrl?: string,
): Promise<string> {
  if (!phone) return 'No phone number provided.';
  if (!message) return 'No message provided.';

  // Normalize phone
  let normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) normalized = '+' + normalized;

  try {
    const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
    const provider = await getWhatsAppProvider(toolCtx.businessId);
    
    let result;
    if (imageUrl) {
      result = await provider.sendImage(
        normalized,
        imageUrl,
        message,
        toolCtx.businessId,
      );
    } else {
      result = await provider.sendWhatsApp(
        normalized,
        message,
        toolCtx.businessId,
      );
    }

    if (!result.sent) {
      return `Failed to send WhatsApp to ${normalized}: ${result.error || 'Unknown error'}`;
    }

    // Auto-register as supplier if not already known
    // This ensures when they reply, the webhook recognizes them as a supplier
    if (normalized !== toolCtx.ownerPhone) {
      try {
        const supabase = getSupabase();
        const { data: existing } = await supabase
          .from('suppliers')
          .select('id')
          .eq('business_id', toolCtx.businessId)
          .eq('whatsapp_number', normalized)
          .maybeSingle();

        if (!existing) {
          // Try to extract a name from the message context
          const nameMatch = message.match(/(?:Hola|Hi|Hello|Dear|Estimad[oa]s?)\s+([^,.\n!]+)/i);
          const supplierName = nameMatch?.[1]?.trim() || `Supplier ${normalized}`;
          await supabase.from('suppliers').insert({
            business_id: toolCtx.businessId,
            name: supplierName,
            whatsapp_number: normalized,
          });
          console.log(`[send_whatsapp] Auto-registered supplier: ${supplierName} (${normalized})`);
        }
      } catch (err) {
        // Non-fatal — supplier registration is best-effort
        console.warn('[send_whatsapp] Auto-register supplier failed (non-fatal):', err);
      }
    }

    return `Message sent to ${normalized} via WhatsApp.`;
  } catch (err) {
    return `Failed to send WhatsApp: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── manage_job (create/update jobs table) ──────────────────────────────

async function executeManageJob(
  args: Record<string, unknown>,
  businessId: string,
): Promise<string> {
  const supabase = getSupabase();
  const action = args.action as string;

  if (action === 'create') {
    const row: Record<string, unknown> = {
      business_id: businessId,
      title: (args.title as string) || 'Untitled Job',
      status: (args.status as string) || 'draft',
      description: (args.description as string) || null,
      materials_needed: args.materials_needed || [],
      blockers: args.blockers || [],
      metadata: args.metadata || {},
    };

    const { data, error } = await supabase
      .from('jobs')
      .insert(row)
      .select('id, title, status')
      .single();

    if (error) return `Failed to create job: ${error.message}`;
    return `Job created: "${data.title}" (ID: ${data.id}, status: ${data.status})`;
  }

  if (action === 'update') {
    const jobId = args.jobId as string;
    if (!jobId) return 'jobId is required for update action.';

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.title) updates.title = args.title;
    if (args.status) updates.status = args.status;
    if (args.description) updates.description = args.description;
    if (args.materials_needed) updates.materials_needed = args.materials_needed;
    if (args.blockers) updates.blockers = args.blockers;
    if (args.metadata) updates.metadata = args.metadata;

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
      .eq('business_id', businessId)
      .select('id, title, status')
      .single();

    if (error) return `Failed to update job: ${error.message}`;
    return `Job updated: "${data.title}" (status: ${data.status})`;
  }

  return `Unknown action: ${action}. Use "create" or "update".`;
}


// ─── delegate_task (orchestrator spins up sub-agent) ─────────────────────

async function executeDelegateTask(
  assistantConfigName: string,
  instruction: string,
  toolCtx: ToolContext,
): Promise<string> {
  try {
    const supabase = getSupabase();
    const { data: assistant } = await supabase
      .from('assistants')
      .select('system_prompt, tools_enabled')
      .eq('business_id', toolCtx.businessId)
      .eq('name', assistantConfigName)
      .limit(1)
      .maybeSingle();

    if (!assistant) {
      return `Failed: Could not find an assistant named "${assistantConfigName}". Available ones typically are "Purchasing OS", "Marketing OS", etc.`;
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) return 'Failed: QSTASH_TOKEN missing, cannot dispatch sub-agent.';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.launchfly.ai';
    const targetUrl = `${appUrl.replace(/\/$/, '')}/api/agent/run`;
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';

    const rawTools = assistant.tools_enabled;
    const enabledTools = Array.isArray(rawTools) ? rawTools.map(String) : [];

    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Retries': '1',
        'Upstash-Delay': '1s',
      },
      body: JSON.stringify({
        businessId: toolCtx.businessId,
        goal: `[DELEGATED TASK] ${instruction}`,
        role: assistant.system_prompt,
        enabledTools,
      }),
    });

    if (!res.ok) {
      return `Failed: QStash returned ${res.status}`;
    }

    return `Successfully dispatched task to ${assistantConfigName}. The agent will work in the background.`;
  } catch (err) {
    return `Failed to delegate: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── analyze_inventory (visual comparison via GPT-4o Vision) ─────────────

async function executeAnalyzeInventory(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const action = args.action as string;
  const imageUrl = args.imageUrl as string | undefined;
  const label = args.label as string | undefined;
  const category = args.category as string | undefined;
  const goldenImageId = args.goldenImageId as string | undefined;

  try {
    const {
      saveGoldenStateImage,
      getGoldenStateImages,
      compareInventoryImages,
      analyzeInventoryImage,
    } = await import('@/lib/vision-inventory');

    switch (action) {
      case 'set_golden': {
        if (!imageUrl) return 'Error: imageUrl is required to save a golden state image.';
        const result = await saveGoldenStateImage(toolCtx.businessId, imageUrl, label, category);
        if (!result.success) return `Failed to save golden state: ${result.error}`;
        return `Golden state image saved (id: ${result.id}). Label: "${label || 'default'}". The owner can now send post-market photos and I will compare against this reference.`;
      }

      case 'list_golden': {
        const images = await getGoldenStateImages(toolCtx.businessId);
        if (images.length === 0) return 'No golden state images saved yet. Ask the owner to send a photo of their fully stocked inventory and tell me to save it as the reference.';
        const list = images.map((img: Record<string, unknown>, i: number) =>
          `${i + 1}. [${img.label || 'No label'}] (${img.category || 'general'}) — saved ${new Date(img.created_at as string).toLocaleDateString()} — id: ${img.id}`
        ).join('\n');
        return `Golden state images:\n${list}`;
      }

      case 'analyze': {
        if (!imageUrl) return 'Error: imageUrl is required to analyze an image.';
        const businessName = toolCtx.businessName || 'this business';
        const description = await analyzeInventoryImage(imageUrl, `Business: ${businessName}`);
        return `Image analysis:\n${description}`;
      }

      case 'compare': {
        if (!imageUrl) return 'Error: imageUrl is required for comparison (this should be the current/post-market photo).';

        // Find the golden state to compare against
        const goldens = await getGoldenStateImages(toolCtx.businessId);
        if (goldens.length === 0) {
          return 'No golden state reference image found. The owner needs to first send a photo of their fully stocked inventory and tell me to save it as the golden state reference. Then I can compare future photos against it.';
        }

        let goldenImage = goldens[0]; // most recent by default
        if (goldenImageId) {
          const specific = goldens.find((g: Record<string, unknown>) => g.id === goldenImageId);
          if (specific) goldenImage = specific;
        }

        const diff = await compareInventoryImages({
          currentImageUrl: imageUrl,
          goldenImageUrl: goldenImage.image_url as string,
          businessContext: toolCtx.businessName || undefined,
        });

        let report = `📊 *Inventory Comparison Report*\n`;
        report += `Reference: "${goldenImage.label || 'Golden state'}"\n\n`;
        report += `*Summary:* ${diff.summary}\n\n`;

        if (diff.missingItems.length > 0) {
          report += `*Missing Items:*\n`;
          diff.missingItems.forEach((item) => {
            report += `  ❌ ${item.item}${item.estimatedQty ? ` (×${item.estimatedQty})` : ''}${item.location ? ` — ${item.location}` : ''}\n`;
          });
          report += '\n';
        }

        if (diff.lowStockItems.length > 0) {
          report += `*Low Stock:*\n`;
          diff.lowStockItems.forEach((item) => {
            report += `  ⚠️ ${item.item}${item.estimatedRemaining ? ` (~${item.estimatedRemaining} left)` : ''}${item.location ? ` — ${item.location}` : ''}\n`;
          });
          report += '\n';
        }

        if (diff.suggestedPO) {
          report += `*Suggested Purchase Order:*\n${diff.suggestedPO}`;
        }

        return report;
      }

      default:
        return `Unknown analyze_inventory action: ${action}. Use: compare, set_golden, analyze, or list_golden.`;
    }
  } catch (err) {
    return `Inventory analysis failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE: Await-able Delegation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delegate a task to a sub-agent and PAUSE until it completes.
 * Returns a special __PAUSE__ signal that the runner interprets
 * to save state and stop looping.
 */
async function executeDelegateTaskAndWait(
  assistantConfigName: string,
  instruction: string,
  toolCtx: ToolContext,
): Promise<string> {
  if (!toolCtx.taskId) return 'Failed: No task ID available (cannot pause without task context).';

  try {
    const supabase = getSupabase();
    const { data: assistant } = await supabase
      .from('assistants')
      .select('system_prompt, tools_enabled')
      .eq('business_id', toolCtx.businessId)
      .eq('name', assistantConfigName)
      .limit(1)
      .maybeSingle();

    if (!assistant) {
      return `Failed: Could not find assistant "${assistantConfigName}".`;
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) return 'Failed: QSTASH_TOKEN missing.';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.launchfly.ai';
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const targetUrl = `${appUrl.replace(/\/$/, '')}/api/agent/run`;

    const rawTools = assistant.tools_enabled;
    const enabledTools = Array.isArray(rawTools) ? rawTools.map(String) : [];

    // Create sub-task ID so we can link it
    const subTaskId = crypto.randomUUID();

    // Dispatch sub-agent with parent linkage
    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Retries': '1',
        'Upstash-Delay': '1s',
      },
      body: JSON.stringify({
        taskId: subTaskId,
        businessId: toolCtx.businessId,
        goal: `[DELEGATED TASK] ${instruction}`,
        role: assistant.system_prompt,
        enabledTools,
        ownerPhone: toolCtx.ownerPhone,
        parentTaskId: toolCtx.taskId,
      }),
    });

    if (!res.ok) return `Failed: QStash returned ${res.status}`;

    // Return pause signal — runner will stop looping and set status
    return `__PAUSE__:waiting_subtask:${subTaskId}:Delegated to ${assistantConfigName}. Task will resume when sub-agent completes.`;
  } catch (err) {
    return `Failed to delegate: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE: Approval Gates
// ═══════════════════════════════════════════════════════════════════════════

async function executeRequestApproval(
  question: string,
  options: string[] | undefined,
  toolCtx: ToolContext,
): Promise<string> {
  if (!toolCtx.taskId) return 'Failed: No task ID available (cannot pause without task context).';
  if (!toolCtx.ownerPhone) return 'Failed: No owner phone configured — cannot request approval.';

  try {
    const supabase = getSupabase();

    // Create approval record
    const { data: approval, error } = await supabase
      .from('agent_pending_approvals')
      .insert({
        task_id: toolCtx.taskId,
        business_id: toolCtx.businessId,
        question,
        options: options || ['Approve', 'Reject'],
      })
      .select('id')
      .single();

    if (error || !approval) return `Failed to create approval: ${error?.message || 'unknown'}`;

    // Send WhatsApp to owner
    const optionsList = (options || ['Approve', 'Reject']).map((o, i) => `${i + 1}. ${o}`).join('\n');
    const approvalMsg = `🔔 *Approval Required*${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}\n\n${question}\n\n*Reply with:*\n${optionsList}\n\n_(Or reply freely with your instructions)_`;

    // Send via Launchfly CEO instance
    const launchflyInstance = process.env.LAUNCHFLY_INSTANCE_NAME;
    if (launchflyInstance) {
      const evo = await import('@/lib/evolution');
      const creds = {
        baseUrl: process.env.EVOLUTION_BASE_URL!,
        apiKey: process.env.EVOLUTION_API_KEY!,
        instanceName: launchflyInstance,
      };
      await evo.sendWhatsAppWithCreds(toolCtx.ownerPhone, approvalMsg, creds);
    } else {
      const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
      const provider = await getWhatsAppProvider(toolCtx.businessId);
      await provider.sendWhatsApp(toolCtx.ownerPhone, approvalMsg, toolCtx.businessId);
    }

    // Mark task as waiting
    await supabase.from('agent_tasks').update({
      status: 'waiting_approval',
      updated_at: new Date().toISOString(),
    }).eq('id', toolCtx.taskId);

    return `__PAUSE__:waiting_approval:${approval.id}:Approval request sent to owner. Task will resume when they reply.`;
  } catch (err) {
    return `Failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE: Semantic Memory (pgvector)
// ═══════════════════════════════════════════════════════════════════════════

async function getEmbedding(text: string): Promise<number[]> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000),
  });
  return res.data[0].embedding;
}

async function executeSearchMemory(
  query: string,
  businessId: string,
  category?: string,
  limit: number = 5,
): Promise<string> {
  try {
    const supabase = getSupabase();
    const embedding = await getEmbedding(query);

    // Use Supabase RPC for vector similarity search
    // Falls back to text search if RPC not available
    let results: Array<{ content: string; category: string; importance_score: number; timestamp: string; similarity?: number }> = [];

    try {
      const { data, error } = await supabase.rpc('search_memories', {
        query_embedding: embedding,
        match_business_id: businessId,
        match_category: category || null,
        match_count: limit,
      });

      if (!error && data?.length > 0) {
        results = data;
      }
    } catch {
      // RPC not deployed yet — fall back to text search
    }

    // Fallback: simple text search if vector search returned nothing
    if (results.length === 0) {
      let q = supabase
        .from('ai_memories')
        .select('content, category, importance_score, timestamp')
        .eq('business_id', businessId)
        .eq('archived', false)
        .order('importance_score', { ascending: false })
        .limit(limit);

      if (category) q = q.eq('category', category);
      // Simple keyword matching as fallback
      q = q.ilike('content', `%${query.split(' ').slice(0, 3).join('%')}%`);

      const { data } = await q;
      results = data || [];
    }

    if (results.length === 0) return 'No relevant memories found.';

    return results.map((m, i) => {
      const ago = Math.round((Date.now() - new Date(m.timestamp).getTime()) / 86400000);
      return `${i + 1}. [${m.category}] (${ago}d ago, importance: ${m.importance_score})\n   ${m.content}`;
    }).join('\n\n');
  } catch (err) {
    return `Memory search failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeSaveMemory(
  content: string,
  category: string,
  businessId: string,
  importance: number = 0.5,
): Promise<string> {
  try {
    const supabase = getSupabase();
    const embedding = await getEmbedding(content);

    const { error } = await supabase.from('ai_memories').insert({
      business_id: businessId,
      content,
      category,
      embedding,
      importance_score: Math.max(0, Math.min(1, importance)),
      context: {},
      metadata: { source: 'agent' },
    });

    if (error) return `Failed to save memory: ${error.message}`;
    return `Memory saved: [${category}] "${content.substring(0, 80)}..." (importance: ${importance})`;
  } catch (err) {
    return `Failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
