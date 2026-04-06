const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  // Get all indexes on assistants table
  const { data: indexes, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'assistants'"
  });
  console.log('Indexes:', JSON.stringify(indexes, null, 2), error?.message);

  // Also check constraints
  const { data: constraints, error: e2 } = await supabase.rpc('exec_sql', {
    sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'assistants'::regclass"
  });
  console.log('Constraints:', JSON.stringify(constraints, null, 2), e2?.message);
}
run().catch(console.error);
