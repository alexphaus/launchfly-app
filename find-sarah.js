const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Find Sarah by name
  const { data } = await sb.from('assistants')
    .select('id, name, business_id, trigger_config')
    .ilike('name', '%sarah%')
    .limit(5);

  if (data && data.length > 0) {
    console.log('Found Sarah:');
    for (const a of data) {
      console.log('  ID:', a.id);
      console.log('  Name:', a.name);
      console.log('  Business:', a.business_id);
      const rules = a.trigger_config?.rules || [];
      console.log('  Rules count:', rules.length);
      for (const r of rules) {
        console.log('   -', r.id, '|', r.event, '| enabled:', r.enabled);
        for (const act of (r.actions || [])) {
          console.log('     ', act.type, JSON.stringify(act.config || {}).substring(0, 120));
        }
      }
    }
  } else {
    console.log('No Sarah found by name. Trying business ID...');
    const { data: d2 } = await sb.from('assistants')
      .select('id, name, business_id, active, trigger_config')
      .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a');
    
    for (const a of (d2 || [])) {
      console.log('  ID:', a.id, '| Name:', a.name, '| Active:', a.active);
      const rules = a.trigger_config?.rules || [];
      console.log('  Rules:', rules.length);
      for (const r of rules) {
        console.log('   -', r.id, '|', r.event, '| enabled:', r.enabled);
        for (const act of (r.actions || [])) {
          console.log('     ', act.type, JSON.stringify(act.config || {}).substring(0, 120));
        }
      }
    }
  }
})();
