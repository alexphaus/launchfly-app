require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await sb
    .from('assistants')
    .select('id, name, active, trigger_config')
    .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a');

  if (!data) return console.log('No data');
  
  data.forEach(a => {
    const tc = a.trigger_config;
    const rules = tc?.rules || [];
    console.log(`\nAssistant: ${a.name} | active: ${a.active} | rules: ${rules.length}`);
    rules.forEach((r, i) => {
      if (r.event === 'call_completed') {
        console.log(`  Rule ${i}: ${r.event} | enabled: ${r.enabled}`);
        console.log(`  Conditions: ${JSON.stringify(r.conditions)}`);
        console.log(`  Actions: ${r.actions.map(a => a.type + (a.config?.delayHours ? ` (${a.config.delayHours}h)` : '') + (a.config?.message ? ` "${a.config.message.substring(0, 60)}..."` : '')).join(' → ')}`);
      }
    });
  });
}
check();
