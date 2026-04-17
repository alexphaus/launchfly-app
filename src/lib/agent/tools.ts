// src/lib/agent/tools.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Tool Definitions — OpenAI Function Calling tools
// ═══════════════════════════════════════════════════════════════════════════
//
// Each tool has:
//  1. A JSON schema (for OpenAI function calling)
//  2. An execute() handler that runs the tool and returns a string result

import { createClient } from '@supabase/supabase-js';
import { syncBusinessCrons } from '@/lib/automations/cron';

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
  'search_memory', 'save_memory', 'validate_memory', 'search_tasks',
]);
const INTERNAL_TOOLS = new Set(['save_leads', 'search_google_maps', 'send_whatsapp', 'send_voice_note', 'manage_job', 'delegate_task', 'delegate_task_and_wait', 'request_approval', 'analyze_inventory', 'call_api', 'request_integration', 'browse_web', 'manage_automation', 'run_code', 'update_instructions', 'send_email', 'make_call', 'post_social']);

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
      description: 'Search the web for information. Returns top results with titles, URLs, summaries, and snippets. Use for market research, finding leads, trending topics, competitor analysis. Supports category filtering and date ranges.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          category: { type: 'string', enum: ['company', 'news', 'people', 'research paper', 'personal site', 'financial report'], description: 'Optional category to focus results. Use "company" for business searches, "people" for LinkedIn profiles, "news" for recent articles.' },
          freshness: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Only return results published within this time window. Use for time-sensitive queries.' },
          domains: { type: 'array', items: { type: 'string' }, description: 'Optional list of domains to restrict results to (e.g. ["linkedin.com", "crunchbase.com"])' },
          excludeDomains: { type: 'array', items: { type: 'string' }, description: 'Optional list of domains to exclude from results' },
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
      description: 'Search Google Maps for local businesses. Returns name, phone, rating, review count, address, website. Optionally fetches actual review text (set reviewsPerPlace > 0). Use for lead generation and competitor research.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Business type (e.g. "plumber", "restaurant")' },
          location: { type: 'string', description: 'City, state or area (e.g. "Kuala Lumpur", "Austin, TX")' },
          maxResults: { type: 'number', description: 'Max results to return (default 10, max 50)' },
          reviewsPerPlace: { type: 'number', description: 'Number of reviews to fetch per business (0 = none, max 10). Use when you need review content for analysis.' },
        },
        required: ['query', 'location'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_leads',
      description: 'Save new leads or update existing leads in the business leads database. Use action="save" (default) after search_google_maps to store new leads. Use action="update" to change a lead\'s status, notes, or other fields.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['save', 'update'], description: 'save = insert new leads (default). update = modify existing lead(s) by ID.' },
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
                rating: { type: 'string', description: 'Google rating e.g. "4.5" (optional)' },
                reviews_count: { type: 'string', description: 'Number of Google reviews (optional)' },
                google_maps_url: { type: 'string', description: 'Google Maps URL (optional)' },
              },
              required: ['name', 'phone'],
            },
            description: 'Array of leads to save (for action=save)',
          },
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Lead UUID (required — get from query_database on leads table)' },
                status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'converted', 'lost', 'archived'], description: 'New status for the lead' },
                notes: { type: 'string', description: 'Updated notes (replaces existing notes)' },
                email: { type: 'string', description: 'Updated email' },
                phone: { type: 'string', description: 'Updated phone' },
                category: { type: 'string', description: 'Updated category' },
                name: { type: 'string', description: 'Updated name' },
              },
              required: ['id'],
            },
            description: 'Array of lead updates (for action=update). Each must have an id.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_report',
      description: 'Send a formatted message/report to the business owner via WhatsApp. Use this to deliver completed work, final reports, or ask questions. Include any optional imageUrl to make your report richer.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The content of your report or message.' },
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
      description: `Query or update the business database. IMPORTANT — use ONLY these columns per table:
• leads: id, name, phone, email, website, address, category, notes, source, status, rating, reviews_count, google_maps_url, created_at, updated_at
• customers: id, email, first_name, last_name, phone, name, total_spent, order_count, status, source, notes, tags, is_repeat_customer, building_name, area, referral_code, blast_optout, created_at
• service_records: id, customer_id, service_type, service_name, appliance_type, units_serviced, service_details, amount, currency, payment_status, address, building_name, area, warranty_days, warranty_expires_at, warranty_claimed, next_service_due_at, reminder_sent, feedback_score, feedback_status, feedback_text, service_date, created_at
• bookings: id, customer_id, slot_date, slot_time, status, booking_type, customer_name, customer_phone, customer_address, estimate, notes, created_at
• products: id, name, description, price, compare_at_price, inventory_count, sales_count, conversion_rate, image_url, status, metadata, created_at
• sales: id, product_id, amount, currency, customer_email, customer_name, stripe_session_id, payment_status, order_id, created_at
• jobs: id, title, status, description, materials_needed, blockers, metadata, updated_at
• suppliers: id, name, whatsapp_number, email, category, notes, avg_response_hours, created_at
• chat_history: id, phone, role, content, created_at
• assistants: name, goal, active, custom_rules, tools_enabled
• agent_tasks: id, status, goal, result, steps_used, created_at, updated_at
• businesses: id, name, phone_number, whatsapp_number, booking_url, blast_credits, blast_credits_used, slot_settings, plan_tier, ai_agent_enabled, prospecting_config, outreach_paused, total_revenue, total_leads, created_at (READ-ONLY)
• business_integrations: id, service_name, description, base_url, auth_type, status, config, requested_by, created_at (READ-ONLY)
Do NOT guess columns. If unsure, select * with limit 1 first.`,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['select', 'update', 'insert', 'delete'],
            description: 'Operation type. Default: select. Use update to modify existing rows, insert to add new rows, delete to remove rows. businesses and business_integrations are READ-ONLY (select only).',
          },
          table: {
            type: 'string',
            enum: ['customers', 'leads', 'chat_history', 'bookings', 'jobs', 'suppliers', 'assistants', 'agent_tasks', 'service_records', 'products', 'sales', 'businesses', 'business_integrations'],
            description: 'Which table to query/update. Use "leads" for agent-generated leads. Use "service_records" for service history. Use "businesses" to check own config (read-only).',
          },
          filters: {
            type: 'object',
            description: 'For select: filter rows. For update/delete: match rows to modify (REQUIRED). Simple values = equality (column: value). Operators: {"column": {"gte": "2025-01-01"}} — supports gte, lte, gt, lt, ilike, neq, in (array), is (null/true/false/"not null").',
          },
          data: {
            type: 'object',
            description: 'For insert: the row to insert (column: value pairs). For update: the columns to change (column: newValue). Not used for select/delete.',
          },
          limit: { type: 'number', description: 'Max rows to return for select (default 25, max 100). For update/delete: max rows (default 1, max 50). The response always includes total_matching so you know if more rows exist beyond the limit.' },
          offset: { type: 'number', description: 'Skip this many rows before returning results (for pagination). Use with limit to page through large result sets.' },
          order_by: { type: 'string', description: 'Column to sort by (default: created_at). Prefix with - for ascending, e.g. "-created_at" = oldest first. Default is newest first (descending).' },
          select: { type: 'string', description: 'Columns to select (comma-separated, default *). Also supports COUNT(*) as alias for totals and column, COUNT(*) as alias for grouped counts.' },
        },
        required: ['table'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'draft_content',
      description: 'Use AI to draft high-quality content: social media posts, email campaigns, video scripts, ad copy, blog articles. Pulls business context (services, pricing, location) automatically. For ads and social posts, request multiple variations to A/B test.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['social_post', 'email', 'video_script', 'ad_copy', 'blog', 'sms', 'whatsapp_template', 'google_ad', 'caption'],
            description: 'Type of content to generate',
          },
          topic: { type: 'string', description: 'Topic, angle, or specific instructions for the content. Be detailed — include the offer, pain point, or hook.' },
          platform: { type: 'string', description: 'Target platform (instagram, facebook, tiktok, linkedin, youtube, google, twitter/x, email). Affects format, length, hashtags, and tone.' },
          tone: { type: 'string', description: 'Desired tone/voice: casual, professional, funny, urgent, educational, inspirational, bold. Default: confident and helpful.' },
          audience: { type: 'string', description: 'Target audience (e.g. "homeowners in Sydney", "property managers", "small business owners"). Helps tailor the message.' },
          variations: { type: 'number', description: 'Number of content variations to generate (default 1, max 5). Use 2-3 for A/B testing ads and social posts.' },
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
          delay_minutes: { type: 'number', description: 'Optional delay in minutes before sending the message (e.g., 10 for a 10 min delay, max 60). Use this to simulate natural human pacing when sending multiple outreach messages or to set a reminder.' },
        },
        required: ['phone', 'message'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'send_voice_note',
      description: 'Send a WhatsApp voice note to any phone number. Converts your text to a natural-sounding voice message using AI text-to-speech, then delivers it as a WhatsApp audio message. Use when a personal, warm touch is more effective than text — e.g. follow-ups, greetings, objection handling, or when the owner asks you to "send a voice note".',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number with country code (e.g. "+34612345678")' },
          text: { type: 'string', description: 'The message to speak in the voice note. Write naturally as if speaking aloud — use contractions, pauses, warm tone.' },
        },
        required: ['phone', 'text'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'delegate_task',
      description: 'DANGER: Delegate a specific task to another AI assistant (e.g. Marketing OS, Purchasing OS). ONLY use this if you ABSOLUTELY CANNOT do the task yourself (i.e., you lack the required tools). If you use this, the sub-agent will LOSE your custom report formatting rules. Therefore, DO NOT delegate if your main goal involves a specific output format.',
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
      description: 'Create, update, list, or delete jobs/purchase orders in the jobs table. Use to log new jobs from scope extraction, update status, add materials, record quotes, or flag blockers.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'list', 'delete'], description: 'Create, update, list, or delete a job' },
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
      description: 'DANGER: Delegate a task to another AI assistant AND pause until it completes. Similar to delegate_task, only use if you intrinsically lack the required tools. Any formatting guidelines in your initial prompt WILL NOT transfer to the sub-agent.',
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
      description: 'Save an important insight, decision, or learning to long-term memory. The AI will remember this across future conversations. Use for: supplier reliability notes, owner preferences, pricing patterns, market insights, API recipes, what worked/failed.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The insight or fact to remember (be specific and concise)' },
          category: { type: 'string', enum: ['supplier', 'decision', 'pattern', 'preference', 'market_insight', 'tool_recipe', 'skill', 'general'], description: 'Memory category. Use "skill" to save proven multi-step workflows. Use "tool_recipe" to save working API call patterns.' },
          importance: { type: 'number', description: 'Importance score 0.0-1.0 (default 0.5). Use 0.8+ for critical business decisions.' },
        },
        required: ['content', 'category'],
      },
    },
  },
  // ── Task History Search ─────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'validate_memory',
      description: 'Mark a past memory as validated (it worked) or invalidated (it was wrong). Use when you confirm or disprove a saved strategy, supplier note, price, or pattern. Validated memories get an importance boost; invalidated ones get archived. Helps the memory system learn what actually works.',
      parameters: {
        type: 'object',
        properties: {
          memory_content_snippet: { type: 'string', description: 'A snippet from the memory content (will match via text search)' },
          outcome: { type: 'string', enum: ['validated', 'invalidated', 'superseded'], description: 'validated = confirmed correct/useful, invalidated = wrong/outdated, superseded = replaced by newer info' },
          reason: { type: 'string', description: 'Brief reason for the validation (e.g. "Supplier confirmed 15% discount still active")' },
        },
        required: ['memory_content_snippet', 'outcome'],
      },
    },
  },
  // ── Task History Search (search_tasks) ─────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'search_tasks',
      description: 'Search past completed agent tasks by keyword. Use when the owner asks about previous work, old suppliers, past reports, historical decisions, or anything you did before. Returns matching tasks with their goals and results.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords (e.g. "marble supplier", "weekly report", "inventory check")' },
          days: { type: 'number', description: 'How many days back to search (default: 30, max: 365)' },
        },
        required: ['query'],
      },
    },
  },
  // ── Dynamic API Calling ────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'call_api',
      description: 'Call any external REST API using credentials stored in the business integrations vault. Use this to interact with third-party services (video generators, design tools, analytics platforms, etc.) that the owner has connected. Always search_memory for "tool_recipe" first to check if you already know how to call a specific API. For POST/PUT/DELETE requests that cost money, use request_approval first.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'The integration service name (e.g. "creatomate", "elevenlabs"). Must match a configured integration.' },
          path: { type: 'string', description: 'API endpoint path appended to the base URL (e.g. "/renders", "/v1/text-to-speech")' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default GET)' },
          body: { type: 'object', description: 'JSON request body (for POST/PUT/PATCH)' },
          query_params: { type: 'object', description: 'URL query parameters as key-value pairs' },
          description: { type: 'string', description: 'Brief description of what this API call does (for audit logging)' },
        },
        required: ['service_name', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'request_integration',
      description: 'Connect a new external service/API. If the owner already provided an API key in the conversation, pass it in the api_key field to activate immediately. Otherwise, sends the owner a WhatsApp message asking for the key. For WEBHOOK integrations (Retell, Zapier, Stripe, etc.), set webhook=true — this generates a webhook URL the owner can paste into the external service so the agent wakes up when events arrive.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'Short identifier for the service (e.g. "creatomate", "elevenlabs", "retell_webhook")' },
          display_name: { type: 'string', description: 'Human-readable service name (e.g. "Retell Post-Call Webhook"). Required for new requests.' },
          signup_url: { type: 'string', description: 'URL where the owner can create an account and get an API key. Required for new API requests; optional for webhook-only.' },
          base_url: { type: 'string', description: 'The API base URL (e.g. "https://api.creatomate.com/v1"). Required for API integrations; optional for webhook-only.' },
          reason: { type: 'string', description: 'Why this integration would help the business (1-2 sentences). Required for new requests.' },
          estimated_cost: { type: 'string', description: 'Estimated monthly cost or per-use cost (e.g. "$9/mo", "free")' },
          auth_type: { type: 'string', enum: ['bearer', 'basic', 'query_param', 'custom_header'], description: 'How the API key should be sent (default: bearer)' },
          api_key: { type: 'string', description: 'If the owner already provided the API key in conversation, pass it here to activate immediately.' },
          webhook: { type: 'boolean', description: 'Set to true to generate a webhook URL. The agent will automatically wake up when this service sends events to the URL.' },
          webhook_instructions: { type: 'string', description: 'Instructions for the agent on what to do when a webhook event arrives (e.g. "When a call ends, check the sentiment. If positive, save as lead and follow up via WhatsApp."). Saved so the agent knows how to handle events.' },
        },
        required: ['service_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browse_web',
      description: 'Control a real cloud browser to perform actions on any website — click buttons, fill forms, log in, create accounts, post listings, upload files, and extract data. Powered by Browserbase + Stagehand. Use this when you need to INTERACT with a website (not just read it). For simple reading/searching, prefer search_web or scrape_page. For actions that cost money or are irreversible (placing orders, publishing listings), use request_approval first.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Natural language description of the full task to perform. Be specific: include URLs, what to click, what to type, what to extract. Example: "Go to etsy.com/your-shop/listings, click Add a listing, set title to Handmade Ceramic Mug, set price to $24.99, then click Publish."' },
          url: { type: 'string', description: 'Starting URL to navigate to (e.g. "https://www.etsy.com"). If omitted, the agent starts from a blank page.' },
          extract_schema: { type: 'object', description: 'Optional JSON schema describing the structured data to extract from the page after completing the task. Keys are field names, values are descriptions.' },
          max_steps: { type: 'number', description: 'Maximum number of actions the browser agent can take (default: 20, max: 50). Increase for complex multi-page flows.' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_code',
      description: 'Execute JavaScript/Node.js code in a sandboxed environment. Use for data analysis, calculations, transformations, string processing, generating reports from raw data, testing API responses, or any computation the AI cannot do reliably in its head. The code runs in an isolated VM with no filesystem or network access. Use console.log() to produce output. The last expression value is also captured.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute. Use console.log() for output. Has access to JSON, Math, Date, Array, Object, Map, Set, RegExp, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Buffer, and TextEncoder/TextDecoder.' },
          timeout_ms: { type: 'number', description: 'Max execution time in milliseconds (default: 5000, max: 10000)' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'manage_automation',
      description: 'Create, update, delete, or list automated business workflows (automations). Use when the owner wants recurring scheduled tasks (e.g. "every day at 8pm find 50 leads") or event-triggered actions (e.g. "when a new lead comes in, send a WhatsApp"). This creates the same automations as the Automations tab in the assistant modal.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete', 'list'], description: 'Operation to perform' },
          rule_id: { type: 'string', description: 'Rule ID (required for update/delete). Use list first to find IDs.' },
          name: { type: 'string', description: 'Human-readable automation name (e.g. "Daily Lead Gen Austin Plumbers")' },
          event: {
            type: 'string',
            enum: ['daily_schedule', 'inbound_whatsapp', 'missed_call', 'booking_created', 'booking_cancelled', 'payment_received', 'new_lead_created', 'prospect_found', 'job_completed', 'user_inactive', 'call_completed'],
            description: 'Trigger event. Use daily_schedule for recurring timed tasks.',
          },
          enabled: { type: 'boolean', description: 'Whether the automation is active (default: true)' },
          schedule: {
            type: 'object',
            description: 'Schedule config (required when event is daily_schedule)',
            properties: {
              hour: { type: 'number', description: 'Hour in LOCAL time, 24h format (0-23). 3 AM = 3, 8 PM = 20. Do NOT convert to UTC — the system handles timezone conversion automatically.' },
              minute: { type: 'number', description: 'Minute (0-59, default 0)' },
              days: { type: 'array', items: { type: 'string' }, description: 'Days of week: mon, tue, wed, thu, fri, sat, sun. Default: all 7 days for "every day".' },
              timezone: { type: 'string', description: 'IANA timezone (e.g. America/New_York, Asia/Singapore, Europe/London). Ask the owner if unknown.' },
            },
          },
          actions: {
            type: 'array',
            description: 'Sequential actions to run when triggered. DEFAULT: use `agent_task` with a descriptive agentGoal for anything involving AI, research, dynamic content, lead gen, reports, or follow-ups — the spawned agent has ALL tools available (search_web, run_code, send_whatsapp, search_google_maps, etc.) and is strictly more powerful than any fixed action type. Only use `notify_owner` (static hardcoded text) or `send_whatsapp` (static template) when there is truly nothing dynamic. `delay` pauses the chain. `ai_response` auto-replies to inbound messages.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', description: 'Action type' },
                config: { type: 'object', description: 'Action-specific configuration' },
              },
              required: ['type'],
            },
          },
          conditions: {
            type: 'array',
            description: 'Optional IF conditions before actions fire',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Field to check: message, customer.name, amount, etc.' },
                op: { type: 'string', enum: ['contains', 'equals', 'gt', 'lt', 'exists', 'not_exists', 'not_equals', 'not_contains'] },
                value: { type: 'string', description: 'Value to compare against' },
              },
            },
          },
        },
        required: ['action'],
      },
    },
  },
  // ── Update Instructions (self-improvement) ───────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'update_instructions',
      description: 'Add a new learned rule to your own instructions. This permanently changes how you behave for this business. Use when: (1) the owner corrects you or states a preference ("always quote in PHP", "never contact suppliers on Sunday"), (2) you discover a pattern that should persist ("Supplier X is unreliable", "use GCash not bank transfer for Manila jobs"), (3) you learn a business-specific fact that affects decisions. Rules are capped at 15 — when full, similar rules are merged or the least specific is dropped. The owner can see and edit these rules in the Assistant settings UI.',
      parameters: {
        type: 'object',
        properties: {
          rule: { type: 'string', description: 'The rule to add. Be concise and specific (1-2 sentences max). Example: "Always ask for barangay when processing Manila permits."' },
          replace_rule_index: { type: 'number', description: 'Optional: 0-based index of an existing rule to replace instead of appending. Use when updating/correcting a previous rule.' },
        },
        required: ['rule'],
      },
    },
  },
  // ── Send Email ─────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'send_email',
      description: 'Send an email on behalf of the business. Use for outreach, follow-ups, quotes, appointment confirmations, etc. The email is sent from the business\'s configured sender address via Resend. IMPORTANT: For cold outreach to new contacts, use request_approval first to get owner confirmation before sending.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body (plain text — newlines will be converted to <br> for HTML rendering)' },
          reply_to: { type: 'string', description: 'Optional reply-to email address (defaults to business sender)' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  // ── Make Call (Retell AI voice call) ───────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'make_call',
      description: 'Trigger an AI voice call to a phone number using Retell AI. The call uses the business\'s active assistant configuration (knowledge base, pricing, FAQ, tone, goal) to have an intelligent phone conversation. Use for lead follow-up, appointment reminders, reactivation, review collection. IMPORTANT: For cold calls to new contacts, use request_approval first to get owner confirmation.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number to call (E.164 format preferred, e.g. +14155551234)' },
          customer_name: { type: 'string', description: 'Name of the person being called (used in conversation)' },
          purpose: { type: 'string', description: 'Purpose/context of the call (e.g. "Follow up on HVAC quote for duct cleaning", "Book consultation for roof repair"). This shapes the call conversation.' },
        },
        required: ['phone', 'purpose'],
      },
    },
  },
  // ── Post to Social Media (PostBolt) ────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'post_social',
      description: 'Publish or schedule a social media post to one or more platforms (LinkedIn, Twitter/X, Facebook, Instagram, TikTok, YouTube, Threads, Pinterest, Bluesky, Telegram, Reddit, Google Business, Snapchat). Uses PostBolt integration. The business must have a PostBolt API key configured in integrations.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The post text/caption. Each platform has character limits (e.g. Twitter 280 chars). Keep it concise.' },
          platforms: { type: 'array', items: { type: 'string' }, description: 'Array of platform names to post to. Options: "linkedin", "twitter", "facebook", "instagram", "tiktok", "youtube", "pinterest", "threads", "bluesky", "telegram", "reddit", "google", "snapchat"' },
          media_url: { type: 'string', description: 'Optional HTTPS URL of an image or video to attach to the post.' },
          scheduled_for: { type: 'string', description: 'Optional ISO 8601 datetime to schedule the post for a future time (e.g. "2026-04-14T09:00:00Z"). If omitted, publishes immediately.' },
        },
        required: ['content', 'platforms'],
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
  timeoutMs?: number,
): Promise<string> {
  switch (name) {
    case 'search_web':
      return executeSearchWeb(
        args.query as string,
        args.category as string | undefined,
        args.freshness as string | undefined,
        args.domains as string[] | undefined,
        args.excludeDomains as string[] | undefined,
      );

    case 'scrape_page':
      return executeScrapePage(args.url as string, args.extract as string | undefined);

    case 'search_google_maps':
      return executeSearchGoogleMaps(
        args.query as string,
        args.location as string,
        (args.maxResults as number) || 10,
        toolCtx.businessId,
        timeoutMs,
        (args.reviewsPerPlace as number) || 0,
      );

    case 'save_leads': {
      const action = (args.action as string) || 'save';
      if (action === 'update') {
        return executeUpdateLeads(args.updates as Array<Record<string, string>>, toolCtx.businessId);
      }
      return executeSaveLeads(args.leads as Array<Record<string, string>>, toolCtx.businessId);
    }

    case 'send_report':
      return executeSendReport(args.message as string, toolCtx, args.imageUrl as string | undefined);

    case 'query_database':
      return executeQueryDatabase(
        (args.action as string) || 'select',
        args.table as string,
        args.filters as Record<string, unknown> | undefined,
        args.data as Record<string, unknown> | undefined,
        (args.limit as number) || 25,
        (args.select as string) || '*',
        toolCtx.businessId,
        (args.offset as number) || 0,
        (args.order_by as string) || 'created_at',
      );

    case 'draft_content':
      return executeDraftContent(args as Record<string, unknown>, toolCtx);

    case 'get_weather_forecast':
      return executeGetWeatherForecast(args.location as string);

    case 'send_whatsapp':
      return executeSendWhatsApp(args.phone as string, args.message as string, toolCtx, args.imageUrl as string | undefined, args.delay_minutes as number | undefined);

    case 'send_voice_note':
      return executeSendVoiceNote(args.phone as string, args.text as string, toolCtx);

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

    case 'search_tasks':
      return executeSearchTasks(args.query as string, toolCtx.businessId, (args.days as number) || 30);

    case 'save_memory':
      return executeSaveMemory(args.content as string, args.category as string, toolCtx, (args.importance as number) || 0.5);

    case 'validate_memory':
      return executeValidateMemory(args.memory_content_snippet as string, args.outcome as string, toolCtx.businessId, args.reason as string | undefined);

    case 'call_api':
      return executeCallApi(args as Record<string, unknown>, toolCtx);

    case 'request_integration':
      return executeRequestIntegration(args as Record<string, unknown>, toolCtx);

    case 'browse_web':
      return executeBrowseWeb(args as Record<string, unknown>, toolCtx);

    case 'manage_automation':
      return executeManageAutomation(args as Record<string, unknown>, toolCtx.businessId);

    case 'run_code':
      return executeRunCode(args.code as string, (args.timeout_ms as number) || 5000);

    case 'update_instructions':
      return executeUpdateInstructions(args.rule as string, toolCtx.businessId, toolCtx.assistantName, args.replace_rule_index as number | undefined);

    case 'send_email':
      return executeSendEmail(args as Record<string, unknown>, toolCtx);

    case 'make_call':
      return executeMakeCall(args as Record<string, unknown>, toolCtx);

    case 'post_social':
      return executePostSocial(args as Record<string, unknown>, toolCtx);

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── search_web (via Exa / Jina Reader fallback) ─────────────────────────

async function executeSearchWeb(
  query: string,
  category?: string,
  freshness?: string,
  domains?: string[],
  excludeDomains?: string[],
): Promise<string> {
  // Try Exa first (neural semantic search with rich content), fall back to Jina
  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    try {
      // Build date filter from freshness shorthand
      let startPublishedDate: string | undefined;
      if (freshness) {
        const now = new Date();
        const offsets: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
        const days = offsets[freshness];
        if (days) {
          now.setDate(now.getDate() - days);
          startPublishedDate = now.toISOString();
        }
      }

      const body: Record<string, unknown> = {
        query,
        type: 'auto',
        numResults: 4,
        contents: {
          highlights: { numSentences: 3 },
          text: { maxCharacters: 1000 },
          summary: true,
          livecrawl: 'fallback',
        },
      };
      if (category) body.category = category;
      // Exa restriction: company & people categories don't support date/domain filters
      const restrictedCategory = category === 'company' || category === 'people';
      if (startPublishedDate && !restrictedCategory) body.startPublishedDate = startPublishedDate;
      if (domains?.length && !restrictedCategory) body.includeDomains = domains;
      if (excludeDomains?.length) body.excludeDomains = excludeDomains;

      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': exaKey,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: {
            title: string;
            url: string;
            publishedDate?: string;
            author?: string;
            text?: string;
            highlights?: string[];
            summary?: string;
          }[];
        };
        let output = '';
        for (const r of data.results || []) {
          const date = r.publishedDate ? ` (${r.publishedDate.split('T')[0]})` : '';
          const author = r.author ? ` — by ${r.author}` : '';
          output += `- **${r.title}**${date}${author}\n  ${r.url}\n`;
          if (r.summary) {
            output += `  Summary: ${r.summary}\n`;
          }
          if (r.highlights?.length) {
            output += `  ${r.highlights.join(' … ').substring(0, 600)}\n`;
          } else if (r.text) {
            output += `  ${r.text.substring(0, 600)}\n`;
          }
        }
        return output || 'No results found.';
      }
      // Log Exa error for debugging
      const errBody = await res.text().catch(() => '');
      console.warn(`[agent:search_web] Exa returned ${res.status}: ${errBody.substring(0, 200)}`);
    } catch (err) {
      console.warn('[agent:search_web] Exa failed, trying Jina:', err);
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

  return 'Search failed — no API keys configured. Set EXA_API_KEY in your environment.';
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

  // Try Exa /contents first (livecrawl, better quality), fall back to Jina
  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    try {
      const res = await fetch('https://api.exa.ai/contents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': exaKey,
        },
        body: JSON.stringify({
          urls: [url],
          text: { maxCharacters: 40000 },
          summary: true,
          livecrawl: 'fallback',
          livecrawlTimeout: 15000,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { text?: string; summary?: string; title?: string }[];
        };
        const page = data.results?.[0];
        if (page?.text) {
          const content = page.text.substring(0, 40000);
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
        }
      }
    } catch (err) {
      console.warn('[agent:scrape_page] Exa /contents failed, trying Jina:', err);
    }
  }

  // Fallback: Jina Reader
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return `Scrape failed: HTTP ${res.status}`;

    const text = await res.text();
    const content = text.substring(0, 40000);

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
  timeoutMs?: number,
  reviewsPerPlace?: number,
): Promise<string> {
  try {
    const { searchGoogleMaps } = await import('@/lib/apify');
    const leads = await searchGoogleMaps({
      query,
      location,
      maxResults: Math.min(maxResults, 50),
      businessId,
      timeoutMs,
      reviewsPerPlace: Math.min(reviewsPerPlace || 0, 10),
    });

    if (!leads.length) return 'No businesses found on Google Maps for that query.';

    let output = `Found ${leads.length} businesses:\n\n`;
    for (const l of leads) {
      output += `- **${l.title}** | ${l.phone || 'No phone'} | ⭐${l.rating || 'N/A'} (${l.reviewsCount || 0} reviews)\n`;
      if (l.address) output += `  📍 ${l.address}\n`;
      if (l.website) output += `  🌐 ${l.website}\n`;
      if (l.reviews?.length) {
        output += `  📝 Recent reviews:\n`;
        for (const rev of l.reviews) {
          output += `    - ⭐${rev.stars} (${rev.publishedAtDate}): "${rev.text?.substring(0, 200) || 'No text'}"\n`;
        }
      }
      output += '\n';
    }
    return output;
  } catch (err) {
    return `Google Maps search failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── save_leads / update_leads ───────────────────────────────────────────

const VALID_LEAD_STATUSES = new Set(['new', 'contacted', 'qualified', 'converted', 'lost', 'archived']);

async function executeUpdateLeads(
  updates: Array<Record<string, string>>,
  businessId: string,
): Promise<string> {
  if (!updates?.length) return 'No updates provided. Pass an array of { id, status?, notes?, ... } objects.';

  const supabase = getSupabase();
  let updated = 0;
  const errors: string[] = [];

  for (const u of updates) {
    if (!u.id) {
      errors.push('Missing id for one update entry');
      continue;
    }

    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (u.status !== undefined) {
      if (!VALID_LEAD_STATUSES.has(u.status)) {
        errors.push(`${u.id}: invalid status "${u.status}". Use: ${[...VALID_LEAD_STATUSES].join(', ')}`);
        continue;
      }
      fields.status = u.status;
    }
    if (u.notes !== undefined) fields.notes = u.notes;
    if (u.email !== undefined) fields.email = u.email || null;
    if (u.phone !== undefined) fields.phone = u.phone || null;
    if (u.category !== undefined) fields.category = u.category || null;
    if (u.name !== undefined) fields.name = u.name;

    if (Object.keys(fields).length <= 1) {
      errors.push(`${u.id}: no fields to update`);
      continue;
    }

    const { error } = await supabase
      .from('leads')
      .update(fields)
      .eq('id', u.id)
      .eq('business_id', businessId);

    if (error) {
      errors.push(`${u.id}: ${error.message}`);
    } else {
      updated++;
    }
  }

  let result = `Updated ${updated} of ${updates.length} leads.`;
  if (errors.length > 0) result += `\nErrors: ${errors.slice(0, 5).join('; ')}`;
  return result;
}

async function executeSaveLeads(
  leads: Array<Record<string, string>>,
  businessId: string,
): Promise<string> {
  if (!leads?.length) return 'No leads provided.';

  const supabase = getSupabase();
  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    // Normalize phone: strip everything except digits and leading +
    let phone = (lead.phone || '').replace(/[^\d+]/g, '');
    phone = phone.replace(/^\++/, '+').replace(/(?!^)\+/g, '');
    if (phone && phone.length < 7) phone = ''; // too short

    // Must have at least a name
    const name = lead.name || 'Unknown';

    // Upsert: if same business + phone exists, skip (unique index handles this)
    const row: Record<string, unknown> = {
      business_id: businessId,
      name,
      phone: phone || null,
      email: lead.email || null,
      website: lead.website || null,
      address: lead.address || null,
      category: lead.category || null,
      notes: lead.notes || null,
      source: 'agent',
      status: 'new',
      rating: lead.rating ? parseFloat(lead.rating) : null,
      reviews_count: lead.reviews_count ? parseInt(lead.reviews_count, 10) : null,
      google_maps_url: lead.google_maps_url || null,
    };

    const { error } = await supabase.from('leads').insert(row);

    if (error) {
      if (error.code === '23505') {
        // Duplicate (unique constraint on business_id + phone)
        skipped++;
      } else {
        errors.push(`${name}: ${error.message}`);
        skipped++;
      }
    } else {
      saved++;
    }
  }

  let result = `Saved ${saved} leads. Skipped ${skipped} (duplicates or errors).`;
  if (errors.length > 0) result += `\nErrors: ${errors.slice(0, 3).join('; ')}`;
  return result;
}

// ─── send_report ─────────────────────────────────────────────────────────

// ─── send_report ─────────────────────────────────────────────────────────

async function executeSendReport(
  message: string,
  toolCtx: ToolContext,
  imageUrl?: string,
): Promise<string> {
  if (!toolCtx.ownerPhone) return 'Cannot send report — owner phone number not configured.';

  if (toolCtx.ownerPhone.startsWith('test-chat')) {
    const fullMsg = `🤖 *Agent Report${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}*\n\n${message}`;
    return `[TEST] Would send report:\n${fullMsg.substring(0, 300)}...`;
  }

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

const ALLOWED_TABLES = new Set([
  'customers', 'leads', 'chat_history', 'bookings', 'jobs', 'suppliers',
  'assistants', 'agent_tasks', 'service_records', 'products', 'sales',
  'businesses', 'business_integrations',
]);
const READ_ONLY_TABLES = new Set(['businesses', 'business_integrations', 'agent_tasks', 'chat_history', 'sales']);

type ParsedSelect =
  | { kind: 'all' }
  | { kind: 'columns'; columns: string }
  | { kind: 'count'; alias: string }
  | { kind: 'groupCount'; column: string; alias: string }
  | { kind: 'invalid'; reason: string };

// Only allow simple column names plus a small set of safe aggregate shapes.
function parseSelect(select: string): ParsedSelect {
  if (!select || select === '*') return { kind: 'all' };

  const normalized = select.trim().replace(/\s+/g, ' ');

  const countMatch = normalized.match(/^COUNT\(\*\)(?: as ([a-zA-Z_][a-zA-Z0-9_]*))?$/i);
  if (countMatch) {
    return { kind: 'count', alias: countMatch[1] || 'count' };
  }

  const groupCountMatch = normalized.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*COUNT\(\*\)(?: as ([a-zA-Z_][a-zA-Z0-9_]*))?$/i,
  );
  if (groupCountMatch) {
    return {
      kind: 'groupCount',
      column: groupCountMatch[1],
      alias: groupCountMatch[2] || 'count',
    };
  }

  const cols = normalized
    .split(',')
    .map(c => c.trim())
    .filter(c => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));

  if (cols.length > 0 && cols.length === normalized.split(',').length) {
    return { kind: 'columns', columns: cols.join(',') };
  }

  return {
    kind: 'invalid',
    reason: 'Unsupported select expression. Use plain column names, COUNT(*) as alias, or column, COUNT(*) as alias.',
  };
}

// Sanitize data object — only allow safe column names and primitive values
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeKey) continue;
    // Allow primitives, arrays, and plain objects (for jsonb columns)
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      safe[safeKey] = value;
    }
  }
  return safe;
}

// Apply filters to a Supabase query builder
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: Record<string, unknown>) {
  let q = query;
  for (const [key, value] of Object.entries(filters)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeKey) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const ops = value as Record<string, unknown>;
      for (const [op, opVal] of Object.entries(ops)) {
        // Handle operators that accept non-primitive values first
        if (op === 'in') {
          if (Array.isArray(opVal)) {
            q = q.in(safeKey, opVal.filter((v: unknown) => typeof v === 'string' || typeof v === 'number'));
          }
          continue;
        }
        if (op === 'is') {
          if (opVal === null || opVal === 'null') q = q.is(safeKey, null);
          else if (opVal === 'not null' || opVal === 'not_null') q = q.not(safeKey, 'is', null);
          else if (opVal === true || opVal === 'true') q = q.is(safeKey, true);
          else if (opVal === false || opVal === 'false') q = q.is(safeKey, false);
          continue;
        }
        if (op === 'neq') {
          if (opVal === null || opVal === 'null') q = q.not(safeKey, 'is', null);
          else q = q.neq(safeKey, opVal);
          continue;
        }
        // All other operators require string/number
        if (typeof opVal !== 'string' && typeof opVal !== 'number') continue;
        switch (op) {
          case 'gte': q = q.gte(safeKey, opVal); break;
          case 'lte': q = q.lte(safeKey, opVal); break;
          case 'gt': q = q.gt(safeKey, opVal); break;
          case 'lt': q = q.lt(safeKey, opVal); break;
          case 'ilike': {
            const pattern = String(opVal).replace(/[^a-zA-Z0-9%_ @.-]/g, '');
            q = q.ilike(safeKey, pattern);
            break;
          }
        }
      }
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      q = q.eq(safeKey, value);
    }
  }
  return q;
}

async function executeQueryDatabase(
  action: string,
  table: string,
  filters: Record<string, unknown> | undefined,
  data: Record<string, unknown> | undefined,
  limit: number,
  select: string,
  businessId: string,
  offset: number = 0,
  orderBy: string = 'created_at',
): Promise<string> {
  if (!ALLOWED_TABLES.has(table)) return `Table "${table}" not allowed. Use: ${[...ALLOWED_TABLES].join(', ')}`;

  const supabase = getSupabase();
  const effectiveAction = action || 'select';

  // Block writes on read-only tables
  if (effectiveAction !== 'select' && READ_ONLY_TABLES.has(table)) {
    return `Table "${table}" is read-only. You can only use action: "select".`;
  }

  // ─── SELECT ───
  if (effectiveAction === 'select') {
    const parsedSelect = parseSelect(select);
    if (parsedSelect.kind === 'invalid') return parsedSelect.reason;

    if (parsedSelect.kind === 'count') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let countQuery: any = supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);
      if (filters) countQuery = applyFilters(countQuery, filters);
      const { count, error } = await countQuery;
      if (error) return `Query error: ${error.message}`;
      return JSON.stringify({ [parsedSelect.alias]: count ?? 0 }, null, 2);
    }

    if (parsedSelect.kind === 'groupCount') {
      const grouped = new Map<string, { value: string | null; count: number }>();
      const pageSize = 1000;
      let from = 0;
      let truncated = false;

      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pageQuery: any = supabase
          .from(table)
          .select(parsedSelect.column)
          .eq('business_id', businessId);
        if (filters) pageQuery = applyFilters(pageQuery, filters);

        const { data: batch, error } = await pageQuery.range(from, from + pageSize - 1);
        if (error) return `Query error: ${error.message}`;
        if (!batch?.length) break;

        for (const row of batch as Array<Record<string, unknown>>) {
          const rawValue = row[parsedSelect.column];
          const key = rawValue === null || rawValue === undefined ? '__null__' : String(rawValue);
          const existing = grouped.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            grouped.set(key, {
              value: rawValue === null || rawValue === undefined ? null : String(rawValue),
              count: 1,
            });
          }
        }

        if (batch.length < pageSize) break;
        from += pageSize;
        if (from >= 5000) {
          truncated = true;
          break;
        }
      }

      const rows = Array.from(grouped.values())
        .sort((left, right) => right.count - left.count)
        .map(entry => ({
          [parsedSelect.column]: entry.value,
          [parsedSelect.alias]: entry.count,
        }));

      if (!rows.length) return `No results in ${table} matching those filters.`;

      const outputRows = rows.slice(0, Math.min(limit, 100));
      const warning = truncated
        ? '\nWarning: grouped counts truncated after scanning 5000 matching rows.'
        : '';
      return `${rows.length} grouped row(s):\n${JSON.stringify(outputRows, null, 2).substring(0, 6000)}${warning}`;
    }

    // Parse order_by: prefix '-' means ascending (oldest first), default descending
    const ascending = orderBy.startsWith('-');
    const orderColumn = (ascending ? orderBy.slice(1) : orderBy).replace(/[^a-zA-Z0-9_]/g, '') || 'created_at';
    const safeLimit = Math.min(limit, 100);
    const safeOffset = Math.max(0, Math.floor(offset));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from(table)
      .select(parsedSelect.kind === 'columns' ? parsedSelect.columns : '*', { count: 'exact' })
      .eq('business_id', businessId);
    if (filters) query = applyFilters(query, filters);
    const { data: rows, count: totalMatching, error } = await query
      .order(orderColumn, { ascending })
      .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) return `Query error: ${error.message}`;
    if (!rows?.length) return `No results in ${table} matching those filters. (total_matching: 0)`;
    const total = totalMatching ?? rows.length;
    const meta = `Showing ${rows.length} of ${total} total matching rows (offset: ${safeOffset}, limit: ${safeLimit}, order: ${orderColumn} ${ascending ? 'asc' : 'desc'}).`;
    return `${meta}\n${JSON.stringify(rows, null, 2).substring(0, 6000)}`;
  }

  // ─── INSERT ───
  if (effectiveAction === 'insert') {
    if (!data || Object.keys(data).length === 0) return 'Error: "data" object is required for insert.';
    const safeData = sanitizeData(data);
    // Always inject business_id for tenant isolation
    safeData.business_id = businessId;
    const { data: inserted, error } = await supabase.from(table).insert(safeData).select();
    if (error) return `Insert error: ${error.message}`;
    return `Inserted 1 row:\n${JSON.stringify(inserted?.[0], null, 2).substring(0, 3000)}`;
  }

  // ─── UPDATE ───
  if (effectiveAction === 'update') {
    if (!data || Object.keys(data).length === 0) return 'Error: "data" object is required for update.';
    if (!filters || Object.keys(filters).length === 0) return 'Error: "filters" are required for update to avoid overwriting all rows.';
    const safeData = sanitizeData(data);
    // Never allow changing business_id
    delete safeData.business_id;
    delete safeData.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(table).update(safeData).eq('business_id', businessId);
    query = applyFilters(query, filters);
    const maxRows = Math.min(limit || 1, 50);
    const { data: updated, error } = await query.limit(maxRows).select();
    if (error) return `Update error: ${error.message}`;
    if (!updated?.length) return `No rows matched the filters — nothing updated.`;
    return `Updated ${updated.length} row(s):\n${JSON.stringify(updated, null, 2).substring(0, 3000)}`;
  }

  // ─── DELETE ───
  if (effectiveAction === 'delete') {
    if (!filters || Object.keys(filters).length === 0) return 'Error: "filters" are required for delete to avoid deleting all rows.';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(table).delete().eq('business_id', businessId);
    query = applyFilters(query, filters);
    const maxRows = Math.min(limit || 1, 50);
    const { data: deleted, error } = await query.limit(maxRows).select();
    if (error) return `Delete error: ${error.message}`;
    if (!deleted?.length) return `No rows matched the filters — nothing deleted.`;
    return `Deleted ${deleted.length} row(s).`;
  }

  return `Unknown action "${effectiveAction}". Use: select, update, insert, delete.`;
}

// ─── draft_content ───────────────────────────────────────────────────────

async function executeDraftContent(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const type = (args.type as string) || 'social_post';
  const topic = (args.topic as string) || '';
  const platform = args.platform as string | undefined;
  const tone = (args.tone as string) || 'confident and helpful';
  const audience = args.audience as string | undefined;
  const variations = Math.min(Math.max((args.variations as number) || 1, 1), 5);

  if (!topic) return 'Error: "topic" is required.';

  // Pull business context for richer content
  let bizContext = '';
  try {
    const supabase = getSupabase();
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, business_data')
      .eq('id', toolCtx.businessId)
      .single();
    if (biz?.business_data) {
      const bd = biz.business_data as Record<string, unknown>;
      const parts: string[] = [];
      if (bd.industry || bd.category) parts.push(`Industry: ${bd.industry || bd.category}`);
      if (bd.services) parts.push(`Services: ${bd.services}`);
      if (bd.city || bd.location) parts.push(`Location: ${bd.city || bd.location}`);
      if (bd.usp || bd.unique_selling_point) parts.push(`USP: ${bd.usp || bd.unique_selling_point}`);
      if (parts.length > 0) bizContext = `\nBusiness details: ${parts.join('. ')}.`;
    }
  } catch { /* non-fatal */ }

  const platformGuides: Record<string, string> = {
    instagram: 'Instagram: visual-first, use line breaks for readability, 3-5 relevant hashtags at the end, max ~2200 chars but keep punchy (under 300 ideal). Use emojis strategically.',
    facebook: 'Facebook: conversational, storytelling works well, 1-3 hashtags max, can be longer (300-600 chars). Ask a question to drive comments.',
    tiktok: 'TikTok: ultra-casual, trend-aware, hook in first 2 seconds, use popular sounds/formats references, keep caption short (150 chars).',
    linkedin: 'LinkedIn: professional but personable, use line breaks and white space, start with a bold hook, 1300-1700 chars ideal, 3-5 hashtags.',
    youtube: 'YouTube: optimize title (60 chars), description (first 2 lines are key), include timestamps and CTAs, keywords naturally placed.',
    google: 'Google Ads: strict limits — headline max 30 chars (up to 15 headlines), description max 90 chars (up to 4). Focus on keywords, benefits, and clear CTA.',
    'twitter/x': 'Twitter/X: max 280 chars, be punchy and opinionated, 1-2 hashtags, threads for longer content.',
    email: 'Email: compelling subject line (under 50 chars), preview text matters, clear single CTA, mobile-friendly short paragraphs.',
  };
  const platformGuide = platform ? (platformGuides[platform.toLowerCase()] || `Target platform: ${platform}. Optimize format, length, and style accordingly.`) : '';

  try {
    const { generateText } = await import('ai');
    const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');

    const systemPrompt = `You are a world-class content creator and performance marketer for ${toolCtx.businessName || 'a service business'}.${bizContext}

CREATE: ${type} content.
${platformGuide}
Tone: ${tone}.
${audience ? `Target audience: ${audience}.` : ''}
${variations > 1 ? `Generate ${variations} distinct variations. Label them VARIATION 1, VARIATION 2, etc. Each should have a different hook/angle but same core message.` : ''}

Rules:
- Lead with a hook that stops the scroll (pain point, bold claim, or question).
- Focus on benefits and outcomes, not features.
- Include a clear CTA.
- For social posts: include relevant hashtags.
- For ads: keep copy tight, benefit-driven, urgency where appropriate.
- Keep it authentic and human — never corporate or generic.
- Match the tone of a confident expert who genuinely wants to help.`;

    const result = await generateText({
      model: deepseek(MINI_MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create ${type} about: ${topic}` }],
    });

    return result.text;
  } catch (err) {
    return `Failed to draft content: ${err instanceof Error ? err.message : String(err)}`;
  }
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
  delayMinutes?: number,
): Promise<string> {
  if (!phone) return 'No phone number provided.';
  if (!message) return 'No message provided.';

  // Test mode: if the phone is a test-chat placeholder, skip actual sending
  if (phone === 'test-chat-lead' || phone.startsWith('test-chat')) {
    return `[TEST] Would send to ${phone}: "${message.substring(0, 200)}"`;
  }

  // Normalize phone
  let normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) normalized = '+' + normalized;

  try {
    const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
    const provider = await getWhatsAppProvider(toolCtx.businessId);

    // Save to chat history immediately (visible as pending/delayed if needed, though right now we just insert it)
    try {
      const supabase = getSupabase();
      await supabase.from('chat_history').insert({
        business_id: toolCtx.businessId,
        customer_phone: normalized,
        message: message,
        direction: 'outbound',
      });
    } catch (err) {
      console.warn('[send_whatsapp] Failed to save chat history (non-fatal):', err);
    }

    // If delay is requested and valid, route to QStash scheduler instead of sending now
    if (delayMinutes && delayMinutes > 0 && delayMinutes <= 120) {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
        const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
        const targetUrl = `${appUrl}/api/internal/delayed-whatsapp`;
        
        try {
          const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Delay': `${delayMinutes}m`, // Format: "10m", "5s"
            },
            body: JSON.stringify({
              businessId: toolCtx.businessId,
              phone: normalized,
              message,
              imageUrl,
            }),
          });
          
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[send_whatsapp] QStash delay error: ${errText}`);
            return `Failed to schedule message delay: QStash returned ${res.status}`;
          }
          
          return `Successfully scheduled message to ${normalized} with a ${delayMinutes} minute delay. The delivery will happen in the background.`;
        } catch (err: any) {
          console.error('[send_whatsapp] QStash fetch error:', err);
          return `Failed to schedule message delay: ${err.message}`;
        }
      } else {
        console.warn('[send_whatsapp] QSTASH_TOKEN not set, falling back to immediate send');
      }
    }

    // Immediate send (default)
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

    return `Message sent to ${normalized} via WhatsApp.`;
  } catch (err) {
    return `Failed to send WhatsApp: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── send_voice_note (TTS → WhatsApp audio) ─────────────────────────────

async function executeSendVoiceNote(
  phone: string,
  text: string,
  toolCtx: ToolContext,
): Promise<string> {
  if (!phone) return 'No phone number provided.';
  if (!text) return 'No text provided for voice note.';

  let normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) normalized = '+' + normalized;

  try {
    // 1. Generate audio via OpenAI TTS
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'opus',
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

    // 2. Upload to Supabase storage
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    const bucket = 'voice-notes';
    await supabase.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ['audio/ogg', 'audio/opus', 'audio/mpeg'],
      fileSizeLimit: 10 * 1024 * 1024,
    });

    const filename = `${toolCtx.businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ogg`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, audioBuffer, {
        contentType: 'audio/ogg',
        cacheControl: '86400',
      });

    if (uploadError) {
      return `Failed to upload voice note: ${uploadError.message}`;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);

    // 3. Send via WhatsApp
    const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
    const provider = await getWhatsAppProvider(toolCtx.businessId);
    const result = await provider.sendVoiceNote(normalized, publicUrl, toolCtx.businessId);

    if (!result.sent) {
      return `Failed to send voice note to ${normalized}: ${result.error || 'Unknown error'}`;
    }

    return `Voice note sent to ${normalized} via WhatsApp.`;
  } catch (err) {
    return `Failed to send voice note: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── manage_job (create/update jobs table) ──────────────────────────────

const VALID_JOB_STATUSES = new Set(['draft', 'quoting', 'ready', 'blocked', 'completed']);

async function executeManageJob(
  args: Record<string, unknown>,
  businessId: string,
): Promise<string> {
  const supabase = getSupabase();
  const action = args.action as string;

  if (action === 'list') {
    const statusFilter = args.status as string | undefined;
    let query = supabase
      .from('jobs')
      .select('id, title, status, description, materials_needed, blockers, updated_at')
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (statusFilter && VALID_JOB_STATUSES.has(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) return `Failed to list jobs: ${error.message}`;
    if (!data?.length) return 'No jobs found.';

    return data.map((j, i) => {
      const blockerStr = j.blockers?.length ? ` ⚠️ Blockers: ${j.blockers.join(', ')}` : '';
      return `${i + 1}. "${j.title}" (ID: ${j.id}, status: ${j.status})${blockerStr}`;
    }).join('\n');
  }

  if (action === 'create') {
    const status = (args.status as string) || 'draft';
    if (!VALID_JOB_STATUSES.has(status)) {
      return `Invalid status "${status}". Use: ${[...VALID_JOB_STATUSES].join(', ')}`;
    }

    const row: Record<string, unknown> = {
      business_id: businessId,
      title: (args.title as string) || 'Untitled Job',
      status,
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

    if (args.status && !VALID_JOB_STATUSES.has(args.status as string)) {
      return `Invalid status "${args.status}". Use: ${[...VALID_JOB_STATUSES].join(', ')}`;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.status !== undefined) updates.status = args.status;
    if (args.description !== undefined) updates.description = args.description;
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

  if (action === 'delete') {
    const jobId = args.jobId as string;
    if (!jobId) return 'jobId is required for delete action.';

    const { data, error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('business_id', businessId)
      .select('id, title')
      .single();

    if (error) return `Failed to delete job: ${error.message}`;
    return `Job deleted: "${data.title}" (ID: ${data.id})`;
  }

  return `Unknown action: ${action}. Use "create", "update", "list", or "delete".`;
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

    // Create sub-task row in DB so fire-and-forget tasks are still tracked
    const subTaskId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('agent_tasks').insert({
      id: subTaskId,
      business_id: toolCtx.businessId,
      status: 'pending',
      goal: `[DELEGATED TASK] ${instruction}`,
      role: assistant.system_prompt,
      messages: [],
      steps_used: 0,
      tool_log: [],
      owner_phone: toolCtx.ownerPhone || null,
      enabled_tools: enabledTools,
      parent_task_id: toolCtx.taskId || null,
    });

    if (insertErr) return `Failed to create sub-task: ${insertErr.message}`;

    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Retries': '1',
        'Upstash-Delay': '1s',
      },
      body: JSON.stringify({ taskId: subTaskId }),
    });

    if (!res.ok) {
      return `Failed: QStash returned ${res.status}`;
    }

    return `Successfully dispatched task to ${assistantConfigName} (task ID: ${subTaskId}). The agent will work in the background.`;
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

    // Create sub-task row in DB FIRST (so runner can find it)
    const subTaskId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('agent_tasks').insert({
      id: subTaskId,
      business_id: toolCtx.businessId,
      status: 'pending',
      goal: `[DELEGATED TASK] ${instruction}`,
      role: assistant.system_prompt,
      messages: [],
      steps_used: 0,
      tool_log: [],
      owner_phone: toolCtx.ownerPhone || null,
      enabled_tools: enabledTools,
      parent_task_id: toolCtx.taskId,
    });

    if (insertErr) return `Failed to create sub-task: ${insertErr.message}`;

    // Dispatch sub-agent via QStash (only sends taskId — row already exists)
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
// FEATURE: Task History Search
// ═══════════════════════════════════════════════════════════════════════════

async function executeSearchTasks(
  query: string,
  businessId: string,
  days: number = 30,
): Promise<string> {
  try {
    const supabase = getSupabase();
    const safeDays = Math.min(Math.max(1, days), 365);
    const since = new Date(Date.now() - safeDays * 86400000).toISOString();

    // Split query into keywords for flexible matching
    const keywords = query.split(/\s+/).filter(w => w.length > 2).slice(0, 6);
    if (keywords.length === 0) return 'Error: query too short. Provide meaningful search keywords.';

    // Build OR condition: match keywords in goal or result
    const patterns = keywords.map(k => {
      const escaped = k.replace(/[%_]/g, '\\$&');
      return `goal.ilike.%${escaped}%,result.ilike.%${escaped}%`;
    });

    const { data, error } = await supabase
      .from('agent_tasks')
      .select('goal, result, created_at, steps_used')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', since)
      .or(patterns.join(','))
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return `Search failed: ${error.message}`;
    if (!data?.length) return `No matching tasks found in the last ${safeDays} days.`;

    return data.map((t, i) => {
      const d = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const goal = (t.goal || '').substring(0, 120);
      const result = (t.result || '').substring(0, 250);
      return `${i + 1}. [${d}] (${t.steps_used} steps)\n   Goal: ${goal}\n   Result: ${result}`;
    }).join('\n\n');
  } catch (err) {
    return `Task search failed: ${err instanceof Error ? err.message : String(err)}`;
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

    // Fallback: text search if vector search returned nothing
    // No hardcoded stop words — just filter by word length (works in any language)
    if (results.length === 0) {
      let q = supabase
        .from('ai_memories')
        .select('content, category, importance_score, timestamp')
        .eq('business_id', businessId)
        .eq('archived', false)
        .order('importance_score', { ascending: false })
        .limit(limit);

      if (category) q = q.eq('category', category);
      
      // Extract meaningful words (>2 chars) — language-agnostic
      const words = query
        .replace(/[%_'"\\]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2)
        .slice(0, 5);
        
      if (words.length > 0) {
        const orFilter = words.map(w => `content.ilike.%${w}%`).join(',');
        q = q.or(orFilter);
      }

      const { data } = await q;
      // Also alias created_at/timestamp properly
      results = (data || []).map((row: any) => ({
        ...row,
        timestamp: row.timestamp || row.created_at || new Date().toISOString()
      }));
    } else {
      // Map RPC data if needed
      results = results.map((row: any) => ({
        ...row,
        timestamp: row.timestamp || row.created_at || new Date().toISOString()
      }));
    }

    if (results.length === 0) return 'No relevant memories found.';

    return results.map((m, i) => {
      const ts = m.timestamp ? new Date(m.timestamp).getTime() : Date.now();
      const ago = isNaN(ts) ? 0 : Math.round((Date.now() - ts) / 86400000);
      return `${i + 1}. [${m.category}] (${ago}d ago, importance: ${m.importance_score})\n   ${m.content}`;
    }).join('\n\n');
  } catch (err) {
    return `Memory search failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeSaveMemory(
  content: string,
  category: string,
  toolCtx: ToolContext,
  importance: number = 0.5,
): Promise<string> {
  try {
    const supabase = getSupabase();
    const embedding = await getEmbedding(content);
    const clampedImportance = Math.max(0, Math.min(1, importance));

    const { error } = await supabase.from('ai_memories').insert({
      business_id: toolCtx.businessId,
      content,
      category,
      embedding,
      importance_score: clampedImportance,
      context: {},
      metadata: { source: 'agent' },
    });

    if (error) return `Failed to save memory: ${error.message}`;

    // ── Auto-alert owner on high-value strategic insights ──
    if (category === 'strategic_insight' && clampedImportance >= 0.8 && toolCtx.ownerPhone) {
      try {
        const alertMsg = `💡 *Strategic Insight — ${toolCtx.businessName || 'Your Business'}*\n\n${content.substring(0, 800)}\n\n_Your AI agent flagged this as high-confidence. Reply to discuss._`;
        await executeSendWhatsApp(toolCtx.ownerPhone, alertMsg, toolCtx);
        console.log(`[save_memory] Auto-alerted owner about strategic insight`);
      } catch (alertErr) {
        console.warn('[save_memory] Auto-alert failed (non-fatal):', alertErr);
      }
    }

    return `Memory saved: [${category}] "${content.substring(0, 80)}..." (importance: ${importance})`;
  } catch (err) {
    return `Failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── validate_memory (outcome tracking) ──────────────────────────────────

async function executeValidateMemory(
  snippet: string,
  outcome: string,
  businessId: string,
  reason?: string,
): Promise<string> {
  if (!snippet || snippet.length < 10) return 'Error: memory_content_snippet must be at least 10 characters long to ensure an accurate match.';
  if (!['validated', 'invalidated', 'superseded'].includes(outcome)) {
    return 'Error: outcome must be "validated", "invalidated", or "superseded".';
  }

  const supabase = getSupabase();

  // Find the memory by content snippet
  const { data: matches, error: findErr } = await supabase
    .from('ai_memories')
    .select('id, content, importance_score, category')
    .eq('business_id', businessId)
    .eq('archived', false)
    .ilike('content', `%${snippet.replace(/[%_'"\\]/g, ' ').substring(0, 100)}%`)
    .limit(3);

  if (findErr) return `Search failed: ${findErr.message}`;
  if (!matches?.length) return `No matching memory found for: "${snippet.substring(0, 60)}"`;

  const mem = matches[0]; // Best match

  const now = new Date().toISOString();

  if (outcome === 'validated') {
    // Boost importance by 0.1 (max 1.0)
    const newScore = Math.min(1.0, Math.round((mem.importance_score + 0.1) * 100) / 100);
    // Fetch existing metadata to avoid overwriting
    const { data: full } = await supabase.from('ai_memories').select('metadata').eq('id', mem.id).single();
    const existingMeta = (full?.metadata as Record<string, unknown>) || {};
    const { error } = await supabase
      .from('ai_memories')
      .update({
        outcome: 'validated',
        validated_at: now,
        importance_score: newScore,
        updated_at: now,
        metadata: { ...existingMeta, validated_reason: reason || 'confirmed by agent', validated_at: now },
      })
      .eq('id', mem.id);
    if (error) return `Update failed: ${error.message}`;
    return `✅ Memory validated (importance ${mem.importance_score} → ${newScore}): "${mem.content.substring(0, 80)}"`;
  }

  if (outcome === 'invalidated' || outcome === 'superseded') {
    // Archive the memory — it's no longer accurate
    const { data: full } = await supabase.from('ai_memories').select('metadata').eq('id', mem.id).single();
    const existingMeta = (full?.metadata as Record<string, unknown>) || {};
    const { error } = await supabase
      .from('ai_memories')
      .update({
        outcome,
        validated_at: now,
        archived: true,
        updated_at: now,
        metadata: { ...existingMeta, invalidated_reason: reason || `${outcome} by agent`, invalidated_at: now },
      })
      .eq('id', mem.id);
    if (error) return `Update failed: ${error.message}`;
    return `🗑️ Memory ${outcome} and archived: "${mem.content.substring(0, 80)}"${reason ? ` (${reason})` : ''}`;
  }

  return 'Unknown outcome.';
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE: Dynamic API Calling (call_api + request_integration)
// ═══════════════════════════════════════════════════════════════════════════

const CALL_API_TIMEOUT_MS = 30_000;
const CALL_API_MAX_RESPONSE_BYTES = 50_000; // truncate large API responses

async function executeCallApi(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const serviceName = (args.service_name as string || '').toLowerCase().trim();
  const path = args.path as string || '';
  const method = ((args.method as string) || 'GET').toUpperCase();
  const body = args.body as Record<string, unknown> | undefined;
  const queryParams = args.query_params as Record<string, string> | undefined;
  const description = (args.description as string) || `${method} ${serviceName}${path}`;

  if (!serviceName) return 'Error: service_name is required.';
  if (!path) return 'Error: path is required.';

  const supabase = getSupabase();

  // ── Look up integration credentials ──
  const { data: integration, error: lookupErr } = await supabase
    .from('business_integrations')
    .select('id, base_url, api_key_encrypted, auth_type, auth_header, config, status')
    .eq('business_id', toolCtx.businessId)
    .eq('service_name', serviceName)
    .maybeSingle();

  if (lookupErr) return `Failed to look up integration: ${lookupErr.message}`;

  if (!integration) {
    // List available integrations to help the agent
    const { data: available } = await supabase
      .from('business_integrations')
      .select('service_name, description, status')
      .eq('business_id', toolCtx.businessId)
      .eq('status', 'active');

    const list = available?.length
      ? available.map(a => `• ${a.service_name} — ${a.description || 'no description'}`).join('\n')
      : '(none configured)';

    return `Integration "${serviceName}" not found for this business. Use request_integration to ask the owner to connect it.\n\nAvailable integrations:\n${list}`;
  }

  if (integration.status !== 'active') {
    return `Integration "${serviceName}" exists but is ${integration.status}. Ask the owner to update it.`;
  }

  if (!integration.api_key_encrypted) {
    return `Integration "${serviceName}" is configured but has no API key. Ask the owner to provide one.`;
  }

  // ── Build the request ──
  let url = `${integration.base_url.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      params.append(k, String(v));
    }
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Attach authentication
  // SECURITY TODO: api_key_encrypted is currently stored in PLAINTEXT.
  // Implement AES-256-GCM encryption using a ENCRYPTION_KEY env var before storing,
  // and decrypt here before use. See: https://nodejs.org/api/crypto.html#cryptocipher
  const apiKey = integration.api_key_encrypted;
  if (!apiKey) return `Integration "${serviceName}" has no API key configured.`;
  const authType = integration.auth_type || 'bearer';
  const authHeader = integration.auth_header || 'Authorization';

  switch (authType) {
    case 'bearer':
      headers[authHeader] = `Bearer ${apiKey}`;
      break;
    case 'basic':
      headers[authHeader] = `Basic ${Buffer.from(apiKey).toString('base64')}`;
      break;
    case 'query_param':
      url += (url.includes('?') ? '&' : '?') + `api_key=${encodeURIComponent(apiKey)}`;
      break;
    case 'custom_header':
      headers[authHeader] = apiKey;
      break;
  }

  // ── Execute the request ──
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_API_TIMEOUT_MS);

  try {
    console.log(`[call_api] ${method} ${url} — ${description} (business: ${toolCtx.businessId})`);

    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOpts.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOpts);

    const responseText = await res.text();
    const truncated = responseText.length > CALL_API_MAX_RESPONSE_BYTES
      ? responseText.substring(0, CALL_API_MAX_RESPONSE_BYTES) + '\n... (response truncated)'
      : responseText;

    // Try to parse as JSON for cleaner output
    let output: string;
    try {
      const json = JSON.parse(responseText);
      output = JSON.stringify(json, null, 2);
      if (output.length > CALL_API_MAX_RESPONSE_BYTES) {
        output = output.substring(0, CALL_API_MAX_RESPONSE_BYTES) + '\n... (truncated)';
      }
    } catch {
      output = truncated;
    }

    if (!res.ok) {
      return `API call failed (${res.status} ${res.statusText}):\n${output}`;
    }

    return `API call succeeded (${res.status}):\n${output}`;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return `API call to ${serviceName} timed out after ${CALL_API_TIMEOUT_MS / 1000}s.`;
    }
    return `API call failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── request_integration (agent asks owner to connect a new service) ─────

async function executeRequestIntegration(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const serviceName = (args.service_name as string || '').toLowerCase().trim();
  const displayName = (args.display_name as string) || serviceName;
  const signupUrl = args.signup_url as string;
  const baseUrl = args.base_url as string;
  const reason = args.reason as string;
  const estimatedCost = (args.estimated_cost as string) || 'unknown';
  const authType = (args.auth_type as string) || 'bearer';
  const isWebhook = Boolean(args.webhook);
  const webhookInstructions = (args.webhook_instructions as string) || '';

  if (!serviceName) {
    return 'Error: service_name is required.';
  }
  if (!toolCtx.ownerPhone) {
    return 'Failed: No owner phone configured — cannot send integration request.';
  }

  const providedKey = (args.api_key as string || '').trim();

  const supabase = getSupabase();

  // ── WEBHOOK MODE: generate a secret + URL and register ──
  if (isWebhook) {
    // Check if webhook already exists for this service
    const { data: existing } = await supabase
      .from('business_integrations')
      .select('id, config, status')
      .eq('business_id', toolCtx.businessId)
      .eq('service_name', serviceName)
      .maybeSingle();

    if (existing?.status === 'active') {
      const existingSecret = (existing.config as Record<string, unknown>)?.webhook_secret;
      if (existingSecret) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
        const webhookUrl = `${appUrl}/api/webhook/agent?key=${existingSecret}`;
        return `Webhook already active for "${displayName}".\n\n🔗 Webhook URL:\n${webhookUrl}\n\nPaste this URL in the ${displayName} settings.`;
      }
    }

    // Generate a cryptographically random webhook secret
    const webhookSecret = crypto.randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
    const webhookUrl = `${appUrl}/api/webhook/agent?key=${webhookSecret}`;

    const config: Record<string, unknown> = {
      webhook_secret: webhookSecret,
      display_name: displayName,
      webhook_url: webhookUrl,
    };
    if (webhookInstructions) config.instructions = webhookInstructions;
    if (signupUrl) config.signup_url = signupUrl;
    if (estimatedCost !== 'unknown') config.estimated_cost = estimatedCost;

    const { error } = await supabase.from('business_integrations').upsert({
      business_id: toolCtx.businessId,
      service_name: serviceName,
      description: `${displayName}${reason ? ` — ${reason}` : ''}`,
      base_url: baseUrl || '',
      auth_type: authType,
      api_key_encrypted: providedKey || null,
      status: 'active',
      requested_by: 'agent',
      request_context: reason || 'Webhook integration',
      config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,service_name' });

    if (error) return `Failed to create webhook integration: ${error.message}`;

    // Send the webhook URL to the owner
    const msg = `🔗 *Webhook Ready: ${displayName}*${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}\n\n` +
      `I've set up a webhook so I can wake up when ${displayName} sends events.\n\n` +
      `📋 *Paste this URL in your ${displayName} settings:*\n${webhookUrl}\n\n` +
      (webhookInstructions ? `📌 *When events arrive, I will:* ${webhookInstructions.substring(0, 200)}\n\n` : '') +
      (signupUrl ? `🔗 Service dashboard: ${signupUrl}\n` : '') +
      `_Once configured, I'll automatically process incoming events._`;

    try {
      const launchflyInstance = process.env.LAUNCHFLY_INSTANCE_NAME;
      if (launchflyInstance) {
        const evo = await import('@/lib/evolution');
        const creds = {
          baseUrl: process.env.EVOLUTION_BASE_URL!,
          apiKey: process.env.EVOLUTION_API_KEY!,
          instanceName: launchflyInstance,
        };
        await evo.sendWhatsAppWithCreds(toolCtx.ownerPhone, msg, creds);
      } else {
        const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
        const provider = await getWhatsAppProvider(toolCtx.businessId);
        await provider.sendWhatsApp(toolCtx.ownerPhone, msg, toolCtx.businessId);
      }
    } catch {
      // Still return the URL even if WhatsApp fails
    }

    return `✅ Webhook integration "${displayName}" is ACTIVE.\n\nWebhook URL: ${webhookUrl}\n\nThe owner has been sent this URL. When ${displayName} sends events to this URL, I will wake up and ${webhookInstructions || 'analyze the event and take appropriate action'}.`;
  }

  // ── STANDARD API MODE (existing logic) ──

  // ── Check if already exists ──
  const { data: existing } = await supabase
    .from('business_integrations')
    .select('id, status, api_key_encrypted, display_name')
    .eq('business_id', toolCtx.businessId)
    .eq('service_name', serviceName)
    .maybeSingle();

  if (existing?.status === 'active' && existing.api_key_encrypted) {
    return `Integration "${serviceName}" is already active. Use call_api to use it.`;
  }

  // ── If activating an EXISTING pending request ──
  if (existing?.status === 'pending' && providedKey) {
    const { data: integration, error } = await supabase
      .from('business_integrations')
      .update({
        api_key_encrypted: providedKey,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single();

    if (error) return `Failed to activate integration: ${error.message}`;

    const resolvedName = (existing as any).display_name || existing.id || displayName;
    return `✅ Integration "${resolvedName}" is now ACTIVE (ID: ${integration.id}). You can use call_api with service_name="${serviceName}" immediately.`;
  }

  // ── Make fields required ONLY for new requests ──
  if (!signupUrl || !baseUrl || !reason) {
    return 'Error: For new integrations, signup_url, base_url, and reason are required. If you are activating an existing pending integration, provide api_key and service_name.';
  }

  // ── If owner already provided the API key, activate immediately ──
  if (providedKey) {
    const { data: integration, error } = await supabase
      .from('business_integrations')
      .upsert({
        business_id: toolCtx.businessId,
        service_name: serviceName,
        description: `${displayName} — ${reason}`,
        base_url: baseUrl,
        auth_type: authType,
        api_key_encrypted: providedKey,
        status: 'active',
        requested_by: 'agent',
        request_context: reason,
        config: { signup_url: signupUrl, estimated_cost: estimatedCost, display_name: displayName },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,service_name' })
      .select('id')
      .single();

    if (error) return `Failed to activate integration: ${error.message}`;

    return `✅ Integration "${displayName}" is now ACTIVE (ID: ${integration.id}). You can use call_api with service_name="${serviceName}" immediately.`;
  }

  // ── Guard: max 2 pending integrations at a time to prevent spam ──
  const { count: pendingCount } = await supabase
    .from('business_integrations')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', toolCtx.businessId)
    .eq('status', 'pending');

  if ((pendingCount ?? 0) >= 2) {
    return `Cannot request another integration — there are already ${pendingCount} pending integration requests. Wait for the owner to respond to existing requests before requesting more.`;
  }

  // ── No key provided — upsert a pending record and ask owner ──
  const { data: integration, error } = await supabase
    .from('business_integrations')
    .upsert({
      business_id: toolCtx.businessId,
      service_name: serviceName,
      description: `${displayName} — ${reason}`,
      base_url: baseUrl,
      auth_type: authType,
      status: 'pending',
      requested_by: 'agent',
      request_context: reason,
      config: { signup_url: signupUrl, estimated_cost: estimatedCost, display_name: displayName },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,service_name' })
    .select('id')
    .single();

  if (error) return `Failed to create integration request: ${error.message}`;

  // ── Send WhatsApp message to owner ──
  const msg = `🔌 *New Integration Request*${toolCtx.assistantName ? ` — ${toolCtx.assistantName}` : ''}\n\n` +
    `I found a service that could help your business:\n\n` +
    `*${displayName}*\n` +
    `${reason}\n\n` +
    `💰 Estimated cost: ${estimatedCost}\n` +
    `🔗 Sign up: ${signupUrl}\n\n` +
    `To activate, sign up and share the API key with me in our chat. I'll handle the rest.`;

  // Send via Launchfly CEO instance (same as send_report / request_approval)
  // to prevent feedback loops — business instance messages can echo back as
  // incoming on the CEO webhook and trigger new agent tasks.
  try {
    const launchflyInstance = process.env.LAUNCHFLY_INSTANCE_NAME;
    if (launchflyInstance) {
      const evo = await import('@/lib/evolution');
      const creds = {
        baseUrl: process.env.EVOLUTION_BASE_URL!,
        apiKey: process.env.EVOLUTION_API_KEY!,
        instanceName: launchflyInstance,
      };
      await evo.sendWhatsAppWithCreds(toolCtx.ownerPhone, msg, creds);
    } else {
      // Fallback: use the business provider if CEO instance not configured
      const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
      const provider = await getWhatsAppProvider(toolCtx.businessId);
      await provider.sendWhatsApp(toolCtx.ownerPhone, msg, toolCtx.businessId);
    }
  } catch {
    return `Integration request saved (ID: ${integration.id}) but failed to notify owner via WhatsApp.`;
  }

  return `Integration request sent to owner for "${displayName}" (ID: ${integration.id}). Status: pending. When the owner replies with the API key, it will be activated and available via call_api.`;
}

// ─── manage_automation ───────────────────────────────────────────────────

async function executeManageAutomation(
  args: Record<string, unknown>,
  businessId: string,
): Promise<string> {
  const supabase = getSupabase();
  const action = args.action as string;

  // Load existing rules
  const { data, error } = await supabase
    .from('businesses')
    .select('automation_rules')
    .eq('id', businessId)
    .maybeSingle();

  if (error) return `Error loading automations: ${error.message}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rules: any[] = (data?.automation_rules as any[]) || [];

  switch (action) {
    case 'list': {
      if (rules.length === 0) return 'No automations configured yet.';
      return rules.map((r, i) => {
        const cfg = r.scheduleConfig;
        const sched = cfg
          ? ` @ ${cfg.hour ?? 9}:${String(cfg.minute ?? 0).padStart(2, '0')} ${(cfg.days || []).join(',')} (${cfg.timezone || 'UTC'})`
          : '';
        return `${i + 1}. [${r.enabled !== false ? '✅' : '❌'}] "${r.name || r.id}" — ${r.event}${sched} — ${(r.actions || []).length} action(s)\n   ID: ${r.id}`;
      }).join('\n');
    }

    case 'create': {
      const ruleId = crypto.randomUUID();
      const name = (args.name as string) || 'Untitled Automation';
      const event = (args.event as string) || 'daily_schedule';
      const enabled = args.enabled !== false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedule = args.schedule as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actions = (args.actions as any[]) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions = (args.conditions as any[]) || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newRule: any = {
        id: ruleId,
        name,
        event,
        enabled,
        actions,
      };

      if (conditions.length > 0) newRule.conditions = conditions;

      if (event === 'daily_schedule' && schedule) {
        const rawHour = typeof schedule.hour === 'number' ? schedule.hour : 9;
        const clampedHour = Math.max(0, Math.min(23, Math.round(rawHour)));
        newRule.scheduleConfig = {
          hour: clampedHour,
          minute: Math.max(0, Math.min(59, Math.round(schedule.minute ?? 0))),
          days: schedule.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          timezone: schedule.timezone || 'America/New_York',
        };
      }

      rules.push(newRule);

      // Sync QStash cron schedules
      const syncedRules = await syncBusinessCrons(businessId, rules);

      const { error: saveErr } = await supabase
        .from('businesses')
        .update({ automation_rules: syncedRules })
        .eq('id', businessId);

      if (saveErr) return `Error saving automation: ${saveErr.message}`;

      const cfg = newRule.scheduleConfig;
      const schedInfo = cfg
        ? `\nSchedule: ${cfg.hour}:${String(cfg.minute).padStart(2, '0')} on ${(cfg.days || []).join(', ')} (${cfg.timezone})`
        : '';

      return `✅ Automation created: "${name}"\nID: ${ruleId}\nTrigger: ${event}${schedInfo}\nActions: ${actions.map((a: { type: string }) => a.type).join(' → ')}\n\nThe automation is now LIVE and will run on schedule.`;
    }

    case 'update': {
      const ruleId = args.rule_id as string;
      if (!ruleId) return 'Error: rule_id is required for update. Use action=list to find rule IDs.';

      const idx = rules.findIndex((r: { id: string }) => r.id === ruleId);
      if (idx === -1) return `Error: automation with ID "${ruleId}" not found. Use action=list to see available automations.`;

      const rule = rules[idx];
      if (args.name) rule.name = args.name;
      if (args.event) rule.event = args.event;
      if (args.enabled !== undefined) rule.enabled = args.enabled;
      if (args.actions) rule.actions = args.actions;
      if (args.conditions) rule.conditions = args.conditions;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedule = args.schedule as any;
      if (schedule && (args.event || rule.event) === 'daily_schedule') {
        rule.scheduleConfig = {
          ...rule.scheduleConfig,
          ...(schedule.hour !== undefined && { hour: schedule.hour }),
          ...(schedule.minute !== undefined && { minute: schedule.minute }),
          ...(schedule.days && { days: schedule.days }),
          ...(schedule.timezone && { timezone: schedule.timezone }),
        };
      }

      rules[idx] = rule;

      const syncedRules = await syncBusinessCrons(businessId, rules);

      const { error: saveErr } = await supabase
        .from('businesses')
        .update({ automation_rules: syncedRules })
        .eq('id', businessId);

      if (saveErr) return `Error saving automation: ${saveErr.message}`;
      return `✅ Automation updated: "${rule.name || ruleId}"`;
    }

    case 'delete': {
      const ruleId = args.rule_id as string;
      if (!ruleId) return 'Error: rule_id is required for delete. Use action=list to find rule IDs.';

      const idx = rules.findIndex((r: { id: string }) => r.id === ruleId);
      if (idx === -1) return `Error: automation with ID "${ruleId}" not found.`;

      const name = rules[idx].name || ruleId;

      // Disable first so syncBusinessCrons cleans up the QStash schedule
      rules[idx].enabled = false;
      await syncBusinessCrons(businessId, rules);

      // Now remove from the array
      const finalRules = rules.filter((r: { id: string }) => r.id !== ruleId);

      const { error: saveErr } = await supabase
        .from('businesses')
        .update({ automation_rules: finalRules })
        .eq('id', businessId);

      if (saveErr) return `Error deleting automation: ${saveErr.message}`;
      return `✅ Automation deleted: "${name}". QStash schedule removed.`;
    }

    default:
      return `Unknown action: ${action}. Use: create, update, delete, list`;
  }
}

// ─── update_instructions (self-improvement via custom_rules) ─────────────

const MAX_CUSTOM_RULES = 15;

async function executeUpdateInstructions(
  rule: string,
  businessId: string,
  assistantName?: string,
  replaceIndex?: number,
): Promise<string> {
  const supabase = getSupabase();

  // Sanitize: strip any attempt to inject system-level overrides
  const cleaned = rule.replace(/ignore previous|forget all|override system/gi, '[BLOCKED]').trim();
  if (cleaned.length < 5) return 'Rule too short. Provide a clear, specific instruction (at least 5 characters).';
  if (cleaned.length > 300) return 'Rule too long. Keep it under 300 characters — be concise.';

  // Try to find the specific assistant that is running (by name), else fall back to any active one
  let query = supabase
    .from('assistants')
    .select('id, custom_rules')
    .eq('business_id', businessId)
    .eq('active', true);

  if (assistantName) {
    query = query.eq('name', assistantName);
  }

  const { data: assistant, error: fetchErr } = await query
    .limit(1)
    .maybeSingle();

  if (fetchErr || !assistant) return `Failed to find active assistant: ${fetchErr?.message || 'none found'}`;

  const rules: string[] = (assistant.custom_rules as string[]) || [];

  if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < rules.length) {
    // Replace an existing rule
    const old = rules[replaceIndex];
    rules[replaceIndex] = cleaned;
    const { error: saveErr } = await supabase
      .from('assistants')
      .update({ custom_rules: rules })
      .eq('id', assistant.id);
    if (saveErr) return `Failed to update rule: ${saveErr.message}`;
    return `✅ Updated rule #${replaceIndex + 1}.\nOld: "${old}"\nNew: "${cleaned}"\n(${rules.length} rules total)`;
  }

  // At capacity — find most similar existing rule to merge with, or drop the least specific one
  if (rules.length >= MAX_CUSTOM_RULES) {
    // Find the most similar existing rule (simple word-overlap heuristic — no LLM call needed)
    const newWords = new Set(cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    let bestOverlap = 0;
    let bestIdx = 0;

    for (let i = 0; i < rules.length; i++) {
      const ruleWords = rules[i].toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const overlap = ruleWords.filter(w => newWords.has(w)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }

    if (bestOverlap >= 2) {
      // Merge: keep the new rule, drop the overlapping old one (new supersedes old)
      const dropped = rules[bestIdx];
      rules[bestIdx] = cleaned;
      const { error: saveErr } = await supabase
        .from('assistants')
        .update({ custom_rules: rules })
        .eq('id', assistant.id);
      if (saveErr) return `Failed to save rule: ${saveErr.message}`;
      return `✅ Learned: "${cleaned}"\n(Merged with similar rule #${bestIdx + 1}: "${dropped}")\n(${rules.length}/${MAX_CUSTOM_RULES} rules)`;
    } else {
      // No similar rule — drop the shortest (least specific) rule
      let shortestIdx = 0;
      for (let i = 1; i < rules.length; i++) {
        if (rules[i].length < rules[shortestIdx].length) shortestIdx = i;
      }
      const dropped = rules[shortestIdx];
      rules.splice(shortestIdx, 1);
      rules.push(cleaned);
      const { error: saveErr } = await supabase
        .from('assistants')
        .update({ custom_rules: rules })
        .eq('id', assistant.id);
      if (saveErr) return `Failed to save rule: ${saveErr.message}`;
      return `✅ Learned: "${cleaned}"\n(Dropped least specific rule: "${dropped}" to stay within ${MAX_CUSTOM_RULES} limit)\n(${rules.length}/${MAX_CUSTOM_RULES} rules)`;
    }
  }

  rules.push(cleaned);

  const { error: saveErr } = await supabase
    .from('assistants')
    .update({ custom_rules: rules })
    .eq('id', assistant.id);

  if (saveErr) return `Failed to save rule: ${saveErr.message}`;
  return `✅ Learned: "${cleaned}"\n(${rules.length}/${MAX_CUSTOM_RULES} rules. Owner can review/edit in Assistant settings → Custom Rules.)`;
}

// ─── send_email (via Resend) ─────────────────────────────────────────────

async function executeSendEmail(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const to = (args.to as string || '').trim();
  const subject = (args.subject as string || '').trim();
  const body = (args.body as string || '').trim();
  const replyTo = (args.reply_to as string || '').trim() || undefined;

  if (!to) return 'Error: "to" email address is required.';
  if (!subject) return 'Error: "subject" is required.';
  if (!body) return 'Error: "body" is required.';

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return `Error: "${to}" is not a valid email address.`;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return 'Error: RESEND_API_KEY is not configured.';

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'hello@launchfly.ai';
  const senderName = toolCtx.businessName || 'Launchfly';

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: `${senderName} <${fromEmail}>`,
      to,
      subject,
      html: body.replace(/\n/g, '<br>'),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    return `✅ Email sent to ${to}\nSubject: ${subject}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Failed to send email: ${msg}`;
  }
}

// ─── make_call (Retell AI voice call) ────────────────────────────────────

async function executeMakeCall(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const rawPhone = (args.phone as string || '').trim();
  const customerName = (args.customer_name as string || '').trim() || 'there';
  const purpose = (args.purpose as string || '').trim();

  if (!rawPhone) return 'Error: "phone" number is required.';
  if (!purpose) return 'Error: "purpose" is required — describe why you are calling.';

  const phoneNorm = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

  const retellApiKey = process.env.RETELL_API_KEY;
  if (!retellApiKey) return 'Error: RETELL_API_KEY is not configured.';

  const supabase = getSupabase();

  // Load business context
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, business_data')
    .eq('id', toolCtx.businessId)
    .single();
  const bizName = biz?.name || toolCtx.businessName || 'the team';
  const bizConfig = (biz?.business_data || {}) as Record<string, unknown>;

  // Determine Retell agent mode
  const defaultAgentId = process.env.RETELL_DEFAULT_AGENT_ID || '';
  const defaultFromNumber = process.env.RETELL_DEFAULT_FROM_NUMBER || '';
  const fallbackAgentId = process.env.RETELL_AGENT_ID || '';
  const fallbackFromNumber = process.env.RETELL_FROM_NUMBER || '';

  let agentId = defaultAgentId || fallbackAgentId;
  let fromNumber = defaultFromNumber || fallbackFromNumber;

  if (!agentId || !fromNumber) {
    return 'Error: Missing Retell agent ID or from number. Configure RETELL_DEFAULT_AGENT_ID + RETELL_DEFAULT_FROM_NUMBER env vars.';
  }

  const dynamicVars: Record<string, string> = {
    customer_name: customerName,
    business_name: bizName,
    contractor_name: (bizConfig.ownerName as string) || '',
  };

  // If using default agent, build voice-optimized system prompt from assistant config
  if (defaultAgentId && defaultFromNumber) {
    // Find the business's customer-facing assistant (the one with a receptionist-style goal)
    // Prefer matching by toolCtx.assistantName if available, otherwise find the main receptionist
    let assistantQuery = supabase
      .from('assistants')
      .select('system_prompt, knowledge_base, custom_rules, tone, goal, name')
      .eq('business_id', toolCtx.businessId)
      .eq('active', true);

    if (toolCtx.assistantName) {
      assistantQuery = assistantQuery.eq('name', toolCtx.assistantName);
    } else {
      // Find the receptionist: has a goal set (book_consultation, close_sale, etc.)
      assistantQuery = assistantQuery.not('goal', 'is', null);
    }

    const { data: assistant } = await assistantQuery
      .limit(1)
      .maybeSingle();

    const assistantName = assistant?.name || 'the assistant';
    const tone = assistant?.tone || 'friendly';
    const goal = assistant?.goal || 'book_consultation';
    const ownerName = (bizConfig.ownerName as string) || 'the owner';
    const niche = (bizConfig.niche as string) || 'General Service';

    let voicePrompt = `You are ${assistantName}, an AI phone agent calling on behalf of ${bizName}.
You are on a VOICE CALL — not text. Speak naturally like a real person on the phone.

VOICE RULES (CRITICAL):
- Keep every response to 1-2 SHORT sentences. This is a phone call, not a presentation.
- Be conversational. Use natural speech patterns, contractions, brief pauses.
- NEVER use emojis, bullet points, numbered lists, or any text formatting.
- NEVER read out URLs, links, or long text.
- Sound warm, confident, and human. Not scripted or robotic.
- Match the prospect's energy. If they're short, be short. If they're chatty, be chattier.

YOUR IDENTITY:
- Name: ${assistantName}
- Calling from: ${bizName}
- Tone: ${tone}
- Owner: ${ownerName}
- Industry: ${niche}

CALL PURPOSE: ${purpose}
CUSTOMER NAME: ${customerName}

`;

    // Extract knowledge from Brain tab
    if (assistant?.knowledge_base) {
      const kb = assistant.knowledge_base as Record<string, unknown[]>;
      if ((kb.pricing as { service: string; price: string; unit: string }[])?.length) {
        voicePrompt += 'PRICING KNOWLEDGE (use naturally in conversation, don\'t list them):\n';
        voicePrompt += (kb.pricing as { service: string; price: string; unit: string }[])
          .map(p => `${p.service}: ${p.price}/${p.unit}`)
          .join(', ') + '\n\n';
      }
      if ((kb.faq as { q: string; a: string }[])?.length) {
        voicePrompt += 'KEY ANSWERS (paraphrase naturally, don\'t read verbatim):\n';
        voicePrompt += (kb.faq as { q: string; a: string }[])
          .slice(0, 6)
          .map(f => `If asked "${f.q}" → ${f.a}`)
          .join('\n') + '\n\n';
      }
      if ((kb.objections as { trigger: string; response: string }[])?.length) {
        voicePrompt += 'OBJECTION RESPONSES (adapt to voice naturally):\n';
        voicePrompt += (kb.objections as { trigger: string; response: string }[])
          .map(o => `"${o.trigger}" → ${o.response}`)
          .join('\n') + '\n\n';
      }
    }

    if ((assistant?.custom_rules as string[])?.length) {
      voicePrompt += 'RULES:\n' + (assistant!.custom_rules as string[]).map((r: string) => `- ${r}`).join('\n') + '\n\n';
    }

    // Call flow based on goal
    const goalInstructions: Record<string, string> = {
      close_sale: `CALL FLOW:
1. Quick intro — say who you are and why you're calling (one sentence).
2. Ask ONE qualifying question to hook them into conversation.
3. If they engage, give a brief pitch (2-3 sentences max) focused on their biggest pain point.
4. Handle objections with confidence — don't fold at the first "no". Push back once with value.
5. Drive to action: "Want me to send you more details on WhatsApp right now?"
6. If they say not interested TWICE, respect it. End warmly.`,
      book_consultation: `CALL FLOW:
1. Quick intro — say who you are and why you're calling (one sentence).
2. Ask about their current situation — what are they dealing with?
3. Based on their answer, explain how you can help (2 sentences max).
4. Push for a booking: "I've got Thursday or Friday open — which works better?"
5. If they hesitate, offer to send details on WhatsApp.`,
      collect_review: `CALL FLOW:
1. Quick intro — remind them of the recent service.
2. Ask if everything went well.
3. If happy: "Would you mind leaving us a quick review? I can text you the link."
4. If issue: "I'm sorry to hear that. Let me have the owner reach out."`,
      reactivate: `CALL FLOW:
1. Quick intro — mention you haven't connected in a while.
2. Ask if they have any upcoming projects or needs.
3. Mention any current availability or seasonal relevance.
4. Push for next step: schedule a visit, send a quote, or follow up on WhatsApp.`,
    };

    voicePrompt += (goalInstructions[goal] || goalInstructions.book_consultation) + '\n\n';
    voicePrompt += `CRITICAL: When someone says "not interested" the first time, push back ONCE with a quick value prop. Only back off if they say no a second time.`;

    dynamicVars.system_prompt = voicePrompt;
    agentId = defaultAgentId;
    fromNumber = defaultFromNumber;
  }

  try {
    const retellRes = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: phoneNorm,
        agent_id: agentId,
        retell_llm_dynamic_variables: dynamicVars,
        metadata: {
          business_id: toolCtx.businessId,
          source: 'agent_tool',
          task_id: toolCtx.taskId || null,
        },
      }),
    });

    if (!retellRes.ok) {
      const errBody = await retellRes.text();
      return `Retell API error ${retellRes.status}: ${errBody.substring(0, 200)}`;
    }

    const retellData = (await retellRes.json()) as { call_id?: string };
    return `✅ Voice call triggered to ${phoneNorm} (${customerName})\nCall ID: ${retellData.call_id || 'unknown'}\nPurpose: ${purpose}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Failed to trigger voice call: ${msg}`;
  }
}

// ─── post_social (PostBolt — multi-platform social publishing) ──────────

const VALID_PLATFORMS = new Set([
  'linkedin', 'twitter', 'facebook', 'instagram', 'tiktok',
  'youtube', 'pinterest', 'threads', 'bluesky', 'telegram',
  'reddit', 'google', 'snapchat',
]);

async function executePostSocial(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const content = (args.content as string || '').trim();
  const platforms = args.platforms as string[] | undefined;
  const mediaUrl = args.media_url as string | undefined;
  const scheduledFor = args.scheduled_for as string | undefined;

  if (!content) return 'Error: post content is required.';
  if (!platforms?.length) return 'Error: at least one platform is required.';

  // Validate platforms
  const invalid = platforms.filter(p => !VALID_PLATFORMS.has(p.toLowerCase()));
  if (invalid.length) return `Error: unknown platforms: ${invalid.join(', ')}. Valid: ${[...VALID_PLATFORMS].join(', ')}`;

  const normalizedPlatforms = platforms.map(p => p.toLowerCase());

  // Look up PostBolt credentials from business_integrations
  const supabase = getSupabase();
  const { data: integration } = await supabase
    .from('business_integrations')
    .select('api_key_encrypted, base_url, config, status')
    .eq('business_id', toolCtx.businessId)
    .eq('service_name', 'postbolt')
    .maybeSingle();

  if (!integration) {
    return 'PostBolt is not configured for this business. Ask the owner to add their PostBolt API key in Settings → Integrations (service name: "postbolt").';
  }

  if (integration.status === 'inactive') {
    return 'PostBolt integration is inactive. Ask the owner to re-activate it in Settings → Integrations.';
  }

  const apiKey = integration.api_key_encrypted;
  if (!apiKey) return 'PostBolt API key is missing. Ask the owner to update the integration.';

  const baseUrl = (integration.base_url || 'https://postbolt.dev/api/v1').replace(/\/$/, '');

  // Build request body
  const postBody: Record<string, unknown> = {
    content,
    platforms: normalizedPlatforms,
  };
  if (mediaUrl) postBody.media_url = mediaUrl;
  if (scheduledFor) postBody.scheduled_for = scheduledFor;

  try {
    const res = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postBody),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (data.message || data.error || `HTTP ${res.status}`) as string;
      return `PostBolt error: ${errMsg}`;
    }

    const postId = data.id || 'unknown';
    const status = data.status || 'pending';
    const scheduled = scheduledFor ? ` (scheduled for ${scheduledFor})` : '';
    return `✅ Social post created${scheduled}\nPost ID: ${postId}\nStatus: ${status}\nPlatforms: ${normalizedPlatforms.join(', ')}\nContent: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`;
  } catch (err) {
    return `Failed to publish social post: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── run_code (Sandboxed JS execution via Node VM) ──────────────────────

const RUN_CODE_MAX_TIMEOUT = 10_000; // 10s hard cap
const RUN_CODE_MAX_OUTPUT = 8_000;   // 8KB max output

async function executeRunCode(code: string, timeoutMs: number): Promise<string> {
  const vm = await import('node:vm');

  const effectiveTimeout = Math.min(Math.max(timeoutMs, 500), RUN_CODE_MAX_TIMEOUT);

  // Capture console.log output
  const logs: string[] = [];
  const mockConsole = {
    log: (...args: unknown[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
    warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(a => String(a)).join(' ')),
    error: (...args: unknown[]) => logs.push('[error] ' + args.map(a => String(a)).join(' ')),
    info: (...args: unknown[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
  };

  // Allowlisted globals — safe, no I/O
  const sandbox = {
    console: mockConsole,
    JSON,
    Math,
    Date,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Buffer,
    TextEncoder,
    TextDecoder,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    // Intentionally excluded: fetch, require, import, process, fs, child_process, etc.
  };

  const context = vm.createContext(sandbox, {
    name: 'agent-sandbox',
    codeGeneration: { strings: false, wasm: false },
  });

  try {
    const script = new vm.Script(code, { filename: 'agent-code.js' });
    const result = script.runInContext(context, { timeout: effectiveTimeout });

    const parts: string[] = [];
    if (logs.length > 0) {
      parts.push('=== Console Output ===');
      parts.push(logs.join('\n'));
    }
    if (result !== undefined) {
      parts.push('=== Return Value ===');
      parts.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    }

    if (parts.length === 0) return '(No output produced. Use console.log() to print results.)';

    const output = parts.join('\n');
    if (output.length > RUN_CODE_MAX_OUTPUT) {
      return output.substring(0, RUN_CODE_MAX_OUTPUT) + `\n... (truncated, ${output.length} chars total)`;
    }
    return output;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Script execution timed out')) {
      return `Code execution timed out after ${effectiveTimeout}ms. Simplify the code or increase timeout_ms (max ${RUN_CODE_MAX_TIMEOUT}ms).`;
    }
    return `Code execution error: ${msg}`;
  }
}

// ─── browse_web (Browserbase + Stagehand — real browser automation) ──────

const BROWSE_WEB_TIMEOUT_MS = 120_000; // 2 min max per browser session
const BROWSE_WEB_MAX_STEPS = 50;

async function executeBrowseWeb(
  args: Record<string, unknown>,
  toolCtx: ToolContext,
): Promise<string> {
  const task = (args.task as string || '').trim();
  const startUrl = (args.url as string) || '';
  const extractSchema = args.extract_schema as Record<string, string> | undefined;
  const maxSteps = Math.min(Math.max((args.max_steps as number) || 20, 1), BROWSE_WEB_MAX_STEPS);

  if (!task) return 'Error: task is required — describe what you want the browser to do.';

  const bbApiKey = process.env.BROWSERBASE_API_KEY;
  const bbProjectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!bbApiKey || !bbProjectId) {
    return 'Error: Browserbase is not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables.';
  }

  let stagehand: InstanceType<typeof import('@browserbasehq/stagehand').Stagehand> | null = null;
  let abortTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    const { Stagehand } = await import('@browserbasehq/stagehand');

    console.log(`[browse_web] Starting browser session for: "${task.substring(0, 100)}" (business: ${toolCtx.businessId})`);

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: bbApiKey,
      projectId: bbProjectId,
      model: 'google/gemini-2.5-flash',
      verbose: 0,
      disablePino: true,
    });

    await stagehand.init();

    const sessionUrl = `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`;
    console.log(`[browse_web] Session: ${sessionUrl}`);

    // Navigate to starting URL if provided
    const page = stagehand.context.pages()[0];
    if (startUrl) {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeoutMs: 30_000 });
    }

    // Set up abort timer — close the session to force stop
    const stagehandRef = stagehand;
    abortTimer = setTimeout(async () => {
      console.warn(`[browse_web] Closing session after ${BROWSE_WEB_TIMEOUT_MS / 1000}s timeout`);
      try { await stagehandRef.close(); } catch {}
    }, BROWSE_WEB_TIMEOUT_MS);

    // Use the agent for multi-step task execution
    const agent = stagehand.agent({
      model: 'google/gemini-2.5-flash',
    });

    const result = await agent.execute({
      instruction: task,
      maxSteps,
      page,
    });

    // Extract structured data if schema provided
    let extractedData: string | null = null;
    if (extractSchema && Object.keys(extractSchema).length > 0) {
      try {
        const { z } = await import('zod');
        const shape: Record<string, ReturnType<typeof z.string>> = {};
        for (const [key, desc] of Object.entries(extractSchema)) {
          shape[key] = z.string().describe(desc);
        }
        const schema = z.object(shape);
        const data = await stagehand.extract(
          `Extract the following fields from the current page: ${Object.keys(extractSchema).join(', ')}`,
          schema,
        );
        extractedData = JSON.stringify(data, null, 2);
      } catch (extractErr) {
        extractedData = `Extraction failed: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`;
      }
    }

    // Build response
    const parts: string[] = [];
    parts.push(`Browser session ${result.success ? 'completed successfully' : result.completed ? 'finished' : 'did not complete'}.`);
    parts.push(`Session replay: ${sessionUrl}`);

    if (result.message) {
      parts.push(`\nAgent result: ${result.message}`);
    }

    if (result.actions && result.actions.length > 0) {
      parts.push(`\nActions taken (${result.actions.length}):`);
      for (const action of result.actions.slice(-10)) {
        const timeStr = action.timeMs ? ` (${Math.round(action.timeMs)}ms)` : '';
        const reasoning = action.reasoning ? ` — ${action.reasoning.substring(0, 120)}` : '';
        parts.push(`  • ${action.type}${action.instruction ? `: ${action.instruction.substring(0, 100)}` : ''}${timeStr}${reasoning}`);
      }
    }

    if (extractedData) {
      parts.push(`\nExtracted data:\n${extractedData}`);
    }

    // Token usage for cost tracking
    if (result.usage) {
      parts.push(`\nUsage: ${result.usage.input_tokens} input + ${result.usage.output_tokens} output tokens (${Math.round(result.usage.inference_time_ms / 1000)}s inference)`);
    }

    // Get the final page URL (agent may have navigated)
    try {
      // Check all open pages — agent may have opened new tabs
      const allPages = stagehand.context.pages();
      const activePage = allPages[allPages.length - 1]; // most recently opened
      const finalUrl = activePage.url();
      parts.push(`\nFinal page: ${finalUrl}`);
    } catch { /* page may be closed */ }

    return parts.join('\n');

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[browse_web] Error:`, msg);

    if (msg.includes('aborted') || msg.includes('timed out') || msg.includes('AbortError')) {
      return `Browser session timed out after ${BROWSE_WEB_TIMEOUT_MS / 1000}s. The task may have been too complex. Try breaking it into smaller steps or increasing max_steps.`;
    }

    return `Browser automation failed: ${msg}`;
  } finally {
    if (abortTimer) clearTimeout(abortTimer);
    if (stagehand) {
      try { await stagehand.close(); } catch { /* best effort cleanup */ }
    }
  }
}
