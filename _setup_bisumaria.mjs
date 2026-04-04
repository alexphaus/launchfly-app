import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BIZ_ID = '9187ade5-0f06-4633-ad84-71f5e41b2680';
const ASSISTANT_ID = '83b093a6-5e7e-4b5a-ad5e-d3000aba079f';

// ── 1. Update business data with proper industry info ──
console.log('Updating business data...');
const { data: biz } = await supabase
  .from('businesses')
  .select('business_data')
  .eq('id', BIZ_ID)
  .single();

const updatedBizData = {
  ...biz.business_data,
  niche: 'Jewelry & Handcrafts',
  industry: 'Imitation Jewelry',
  category: 'Medieval Market Vendor',
  city: 'Ocaña',
  location: 'Spain',
  businessName: 'Bisumaria',
  ownerName: 'Maria',
  phone: '34627169287',
  currency: 'EUR',
  currencyCode: 'EUR',
  notes: 'Bisumaria — Imitation jewelry vendor specializing in medieval/renaissance markets across Spain. Owner: Maria. WhatsApp: +34627169287. Key pain points: inventory guessing, dead stock, missed leads between markets, competitor pricing blindspot, social media gaps between events.',
};

await supabase
  .from('businesses')
  .update({
    business_data: updatedBizData,
    whatsapp_notify_number: '+34627169287',
  })
  .eq('id', BIZ_ID);
console.log('✓ Business data updated');

// ── 2. Build the assistant ──
console.log('\nUpdating assistant...');

const systemPrompt = `You are Openclaw, the AI Market Co-Pilot for Bisumaria — a handcrafted imitation jewelry business that sells at medieval and renaissance markets across Spain.

ABOUT THE BUSINESS:
- Owner: Maria
- Products: Handcrafted imitation jewelry (earrings, necklaces, rings, bracelets, ear cuffs, hairpieces) with medieval/renaissance/artisan aesthetic
- Sales channel: In-person at medieval markets, ferias, and craft fairs across Spain
- Online presence: Instagram, possibly Etsy
- Location: Based in Ocaña, Spain — travels to markets across the country

YOUR ROLE:
You are Maria's behind-the-scenes strategic intelligence employee. You handle:
1. TREND SCOUTING — Monitor what's trending in jewelry (Pinterest, Etsy, Instagram, TikTok) and recommend products to stock
2. COMPETITOR ANALYSIS — Track competitor pricing, inventory, and positioning on Etsy and vendor sites
3. MARKET INTELLIGENCE — Find and score upcoming medieval markets, ferias, and craft fairs worth attending
4. CUSTOMER ENGAGEMENT — Answer customer DMs professionally, provide pricing info, share upcoming market dates
5. FOLLOW-UP — Re-engage past buyers between markets with new collection updates and event announcements

COMMUNICATION STYLE:
- Warm, professional, and direct — Maria is a busy solo vendor
- Always write WhatsApp reports in clean, scannable format with emojis for visual anchors
- Use *bold* for emphasis (WhatsApp native)
- Keep recommendations actionable: "Stock 15-20 of X before the April fair" not "Consider exploring X"
- When speaking to Maria's customers: friendly, passionate about the craft, knowledgeable about materials and styles

RULES:
1. Every recommendation must include WHY (trend data, competitor gap, sales history)
2. Never recommend products outside the medieval/artisan/handcraft aesthetic — filter for style fit
3. When scoring markets, consider: distance from Ocaña, expected attendance, competitor density, weather, fees
4. Leads from markets must include: market name, dates, location, organizer, and any available contact info
5. When you finish a task, ALWAYS send a WhatsApp report to Maria with your findings
6. Be honest about data quality — if a trend signal is weak, say so
7. Prices and currency in EUR (€)`;

const knowledgeBase = {
  pricing: [
    'Earrings: €8-25 depending on complexity',
    'Necklaces: €15-45',
    'Rings: €5-18',
    'Bracelets: €10-30',
    'Ear cuffs: €12-35',
    'Hairpieces/tiaras: €20-60',
    'Bundle deals: 3 for 2 on earrings, necklace+earring sets at 15% off',
  ],
  faq: [
    'Q: Are these real gold/silver? A: These are high-quality imitation pieces crafted to look and feel premium. We use hypoallergenic materials safe for sensitive skin.',
    'Q: Where can I see the collection? A: Visit us at the next medieval market! I can send you our upcoming dates. You can also browse our Instagram @bisumaria.',
    'Q: Do you do custom orders? A: Yes! Tell us what you have in mind and we can create a custom piece. Delivery in 1-2 weeks.',
    'Q: Can you ship items? A: Yes, we ship across Spain. Shipping costs €4.95 for standard delivery (3-5 days).',
    'Q: What markets are you attending next? A: Let me check our calendar and send you the upcoming dates!',
    'Q: Do you offer wholesale? A: For bulk orders of 20+ pieces, we offer special pricing. Message us with details.',
  ],
  objections: [
    'Too expensive → Our pieces are handcrafted with premium materials. Each one is unique — you won\'t find mass-produced versions at this quality. Plus, we have bundle deals!',
    'I can find cheaper online → Online pieces often look different in person and use lower-quality materials. Ours are made to last and you can see/touch them before buying.',
    'I\'m just looking → No pressure at all! Take a photo of anything you like and I can send you a link when we\'re at the next market near you.',
    'Not sure it fits my style → We have pieces ranging from subtle everyday wear to bold statement jewelry. What occasion are you thinking of?',
  ],
};

const customRules = [
  'Always recommend trending products that fit the medieval/artisan/handcraft aesthetic — no modern minimalist or mass-produced styles',
  'When a customer asks about upcoming markets, check mercadosmedievales.net for the latest dates',
  'For market scoring, weight proximity to Ocaña (central Spain) heavily — travel costs matter for a solo vendor',
  'Include organizer contact info when available — Maria may want to book a stall',
  'When sending trend reports, always include estimated sourcing cost and retail price recommendation',
  'After each market, prompt Maria to share what sold well — this builds the sales intelligence over time',
  'All currency in EUR (€), all dates in DD/MM/YYYY format (Spanish convention)',
  'If a customer messages in Spanish, always reply in Spanish. If in English, reply in English.',
];

const toolsEnabled = [
  'send_checkout_link',
  'book_calendar',
  'send_template',
  'transfer_to_human',
  'search_web',
  'agent_task',
];

const triggerConfig = {
  whatsapp_webhook: true,
  missed_call: true,
  rules: [
    // ── Inbound customer messages ──
    {
      id: 'rule_bisu_inbound',
      event: 'inbound_whatsapp',
      conditions: [],
      actions: [
        { type: 'ai_response', config: {} },
      ],
      enabled: true,
    },
    // ── Missed calls ──
    {
      id: 'rule_bisu_missed_call',
      event: 'missed_call',
      conditions: [],
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            message: '¡Hola! 👋 Soy el asistente de *Bisumaria*. Vi que nos llamaste — ahora mismo María está ocupada. ¿En qué te puedo ayudar? Si quieres ver nuestras joyas, te puedo enviar fotos o decirte en qué mercado medieval estaremos próximamente 📍✨',
          },
        },
        { type: 'add_tag', config: { tag: 'missed_call' } },
        { type: 'notify_owner', config: { message: '📞 Llamada perdida de {customerName} ({customerPhone})' } },
      ],
      enabled: true,
    },
    // ── New lead ──
    {
      id: 'rule_bisu_new_lead',
      event: 'new_lead_created',
      conditions: [],
      actions: [
        { type: 'add_tag', config: { tag: 'new_lead' } },
      ],
      enabled: true,
    },
    // ── External webhook (for integrations) ──
    {
      id: 'rule_bisu_webhook',
      event: 'external_webhook',
      conditions: [],
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            message: '¡Hola {name}! 👑 Gracias por tu interés en *Bisumaria*. ¿Buscas algo especial? Tenemos piezas únicas hechas a mano con estilo medieval. ¡Pregúntame lo que quieras!',
          },
        },
        { type: 'delay', config: { delayHours: 3 } },
        { type: 'ai_followup', config: {} },
      ],
      enabled: true,
    },
    // ── Weekly Market Scout (every Monday at 9:00 AM Madrid time) ──
    {
      id: 'rule_bisu_weekly_market_scout',
      event: 'daily_schedule',
      conditions: [],
      actions: [
        {
          type: 'agent_task',
          config: {
            agentGoal: `You are Openclaw, Bisumaria's Market Co-Pilot. Today is {date}.

TASK: Find upcoming medieval markets for the NEXT 7 DAYS from today.

STEPS:
1. Scrape this page to find all medieval markets for the current month: https://www.mercadosmedievales.net/2026/MERCADO_MEDIEVAL_2026_ABRIL.htm
   (Note: adjust the month in the URL if needed based on today's date)
2. From the scraped content, extract ONLY markets within the next 7 days from today.
3. Score each market by proximity to Ocaña (Toledo, central Spain), expected attendance if available, and number of competing jewelry vendors.

CRITICAL DATE FILTERING:
- Today is {date}. Calculate the date range for the next 7 days.
- IGNORE any events whose END date is before today.
- IGNORE any events that START more than 7 days from today.
- Include events that OVERLAP with the 7-day window (e.g., started yesterday but ends tomorrow = include).
- Double-check every date before including it.

FORMAT the WhatsApp report like this:

📅 *MERCADOS MEDIEVALES — Próximos 7 días* 📅

1️⃣ *[Nombre del mercado]*
🗓️ *Fechas:* [inicio] - [fin]
📍 *Ubicación:* [Ciudad, Provincia]
🚗 *Distancia desde Ocaña:* [estimación]
👤 *Organizador:* [nombre]
🔗 *Más info:* [URL]

If no markets found in the date range, report that clearly.
End with: "¿Quieres que reserve plaza en alguno? Envíame el número y contacto con el organizador."`,
            agentRole: 'Market Scout — Weekly medieval market finder for Bisumaria',
          },
        },
      ],
      enabled: true,
      scheduleConfig: {
        days: ['mon'],
        hour: 9,
        minute: 0,
        timezone: 'Europe/Madrid',
      },
    },
    // ── Weekly Trend Report (every Wednesday at 10:00 AM Madrid time) ──
    {
      id: 'rule_bisu_weekly_trends',
      event: 'daily_schedule',
      conditions: [],
      actions: [
        {
          type: 'agent_task',
          config: {
            agentGoal: `You are Openclaw, Bisumaria's Market Co-Pilot. Today is {date}.

TASK: Generate a weekly jewelry trend report for Bisumaria — an imitation jewelry vendor at medieval/renaissance markets in Spain.

STEPS:
1. Search the web for current trending jewelry styles, specifically:
   - "trending jewelry 2026" and "trending handmade jewelry"
   - "medieval jewelry trends" and "renaissance fair jewelry popular"
   - "Etsy trending jewelry" and "Pinterest jewelry trends"
2. Search Etsy for bestselling medieval/artisan jewelry: scrape https://www.etsy.com/search?q=medieval+jewelry&order=most_relevant to see what's popular
3. Identify 3-5 specific product opportunities that fit the medieval/artisan aesthetic
4. For each opportunity, estimate: sourcing cost, suggested retail price (€), competition level

FORMAT the WhatsApp report like this:

🔥 *TENDENCIAS JOYERÍA — Semana de {date}* 🔥

1️⃣ *[Producto]*
📈 *Tendencia:* [Por qué está trending + fuente]
💰 *Precio sugerido:* €[precio]
🏷️ *Coste estimado:* €[coste]
⚔️ *Competencia:* [Baja/Media/Alta]
💡 *Recomendación:* [Cuántas unidades stockear y por qué]

End with a brief 1-sentence strategic takeaway for Maria.`,
            agentRole: 'Trend Scout — Weekly jewelry trend analyst for Bisumaria',
          },
        },
      ],
      enabled: true,
      scheduleConfig: {
        days: ['wed'],
        hour: 10,
        minute: 0,
        timezone: 'Europe/Madrid',
      },
    },
    // ── Inactive customer re-engagement ──
    {
      id: 'rule_bisu_inactive',
      event: 'user_inactive',
      conditions: [],
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            message: '¡Hola! 👑 Hace tiempo que no hablamos. En *Bisumaria* tenemos piezas nuevas preciosas — ¿quieres que te envíe fotos de lo último? También te puedo decir en qué mercado medieval estaremos próximamente 📍✨',
          },
        },
        { type: 'delay', config: { delayHours: 48 } },
        { type: 'ai_followup', config: {} },
      ],
      enabled: true,
    },
    // ── Payment received ──
    {
      id: 'rule_bisu_payment',
      event: 'payment_received',
      conditions: [],
      actions: [
        { type: 'add_tag', config: { tag: 'customer' } },
        {
          type: 'send_whatsapp',
          config: {
            message: '¡Gracias por tu compra! 💎✨ Tu pedido de *Bisumaria* está confirmado. Te avisaremos cuando esté enviado. Si tienes alguna pregunta, escríbenos aquí 🙌',
          },
        },
        { type: 'notify_owner', config: { message: '💰 ¡Venta! {customerName} ha pagado {amount}' } },
      ],
      enabled: true,
    },
  ],
};

const sequenceSteps = [
  {
    id: 'step_1',
    name: 'Welcome + Value',
    delayHours: 0,
    message: '¡Bienvenid@ a Bisumaria! 👑 Creamos joyas únicas hechas a mano con estilo medieval y artesano. Cada pieza es especial — no encontrarás dos iguales. ¿Qué tipo de joya te interesa?',
    type: 'whatsapp',
  },
  {
    id: 'step_2',
    name: 'Social proof + upcoming market',
    delayHours: 24,
    message: 'Nuestras clientas favoritas dicen que lo mejor de Bisumaria es tocar las piezas en persona — la calidad se nota ✨ ¿Sabías que estaremos en un mercado medieval pronto? Te puedo enviar la ubicación 📍',
    type: 'whatsapp',
  },
  {
    id: 'step_3',
    name: 'Urgency + offer',
    delayHours: 72,
    message: '¡Última oportunidad! 🔥 Algunas piezas de nuestra nueva colección se están agotando. Si te gustó algo, escríbeme y te lo reservo antes del próximo mercado. ¡No quedan muchas!',
    type: 'whatsapp',
  },
];

// ── 3. Update the assistant ──
const { error } = await supabase
  .from('assistants')
  .update({
    name: 'Openclaw — Market Co-Pilot',
    tone: 'friendly',
    goal: 'close_sale',
    system_prompt: systemPrompt,
    custom_rules: customRules,
    knowledge_base: knowledgeBase,
    tools_enabled: toolsEnabled,
    sequence_steps: sequenceSteps,
    trigger_config: triggerConfig,
    updated_at: new Date().toISOString(),
  })
  .eq('id', ASSISTANT_ID);

if (error) {
  console.error('❌ Assistant update failed:', error.message);
  process.exit(1);
}

console.log('✓ Assistant "Openclaw — Market Co-Pilot" configured');

// ── 4. Verify ──
const { data: verify } = await supabase
  .from('assistants')
  .select('id, name, tone, goal, active, trigger_config')
  .eq('id', ASSISTANT_ID)
  .single();

const ruleCount = verify.trigger_config?.rules?.length || 0;
const scheduledRules = (verify.trigger_config?.rules || []).filter(r => r.scheduleConfig);
console.log(`\n✅ Assistant: ${verify.name}`);
console.log(`   Active: ${verify.active}`);
console.log(`   Goal: ${verify.goal}`);
console.log(`   Total rules: ${ruleCount}`);
console.log(`   Scheduled (cron) rules: ${scheduledRules.length}`);
for (const r of scheduledRules) {
  console.log(`     → ${r.id}: ${r.scheduleConfig.days.join(',')} at ${r.scheduleConfig.hour}:${String(r.scheduleConfig.minute).padStart(2, '0')} ${r.scheduleConfig.timezone}`);
}

console.log('\n🎉 Bisumaria setup complete!');
console.log('   Next step: Connect a WhatsApp number for Maria in the dashboard');
console.log('   Maria\'s notify number set to: +34627169287');
