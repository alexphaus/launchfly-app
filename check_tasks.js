const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
