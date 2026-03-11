const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const SARAH_ID = '11595834-4950-4bfe-af18-b651947a9bd5';
const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const newRules = [
  {
    id: 'rule_lf_daily_prospecting',
    event: 'daily_schedule',
    enabled: true,
    conditions: [],
    scheduleConfig: {
      hour: 9,
      minute: 0,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      timezone: 'America/New_York',
    },
    actions: [
      {
        type: 'search_leads',
        config: {
          searchQuery: 'contractors near me',
          searchLocation: 'Miami, FL',
          searchMaxResults: 50,
        },
      },
    ],
  },
  {
    id: 'rule_lf_prospect_outreach',
    event: 'prospect_found',
    enabled: true,
    conditions: [],
    actions: [
      {
        type: 'stagger_outreach',
        config: {
          staggerIntervalMin: 15,
          staggerMaxPerDay: 15,
        },
      },
      {
        type: 'ai_qualify',
        config: {
          qualifyPrompt: 'Business: {customerName}\nCategory: {metadata.category}\nRating: {metadata.rating} ({metadata.reviews} reviews)\nLocation: {metadata.city}\n\nWe sell AI sales assistants + automated follow-up to contractors and home service businesses at $150/mo.\nIs this business a good prospect? They should be a contractor, home service, or trade business with decent reviews.\nAnswer YES or NO with one reason.',
        },
      },
      {
        type: 'trigger_voice_call',
        config: {
          jobType: 'Launchfly Prospecting Call',
        },
      },
      {
        type: 'send_whatsapp',
        config: {
          message: 'Hey {firstName} 👋 Just tried reaching out from Launchfly. We help contractors like you close more quotes with AI — customers respond faster and you never miss a lead.\n\nReply START to see a quick demo!',
        },
      },
    ],
  },
];

(async () => {
  // Get current config
  const { data: assistant } = await sb
    .from('assistants')
    .select('trigger_config')
    .eq('id', SARAH_ID)
    .single();

  const currentRules = assistant.trigger_config?.rules || [];
  
  // Remove any existing prospecting rules (idempotent)
  const filtered = currentRules.filter(r => 
    r.id !== 'rule_lf_daily_prospecting' && 
    r.id !== 'rule_lf_prospect_outreach'
  );

  // Add new rules
  const updatedRules = [...filtered, ...newRules];

  const { error } = await sb
    .from('assistants')
    .update({
      trigger_config: {
        ...assistant.trigger_config,
        rules: updatedRules,
      },
    })
    .eq('id', SARAH_ID);

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  console.log('Sarah updated successfully!');
  console.log('Total rules:', updatedRules.length);
  console.log('New rules added:');
  for (const r of newRules) {
    console.log('  -', r.id, '|', r.event, '| actions:', r.actions.map(a => a.type).join(' → '));
  }
})();
