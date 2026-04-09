import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testInsert() {
  const { data: biz, error: bizErr } = await supabase.from('businesses').select('id').limit(1).single();
  if (bizErr || !biz) {
    console.error('Failed to get a business', bizErr);
    return;
  }
  
  const taskId = crypto.randomUUID();
  console.log('Inserting with status: pending...');
  const { error } = await supabase.from('agent_tasks').insert({
    id: taskId,
    business_id: biz.id,
    status: 'pending',
    goal: 'Test pending status constraint',
  });
  
  if (error) {
    console.error('Insertion failed!', error);
  } else {
    console.log('Insertion succeeded! Constraint is OK.');
    // clean up
    await supabase.from('agent_tasks').delete().eq('id', taskId);
  }
}

testInsert();
