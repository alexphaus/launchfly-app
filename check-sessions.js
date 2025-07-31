require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSessions() {
  console.log('🔍 Checking recent sessions...\n');
  
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('📭 No sessions found');
      return;
    }
    
    console.log(`📊 Found ${sessions.length} recent sessions:\n`);
    
    sessions.forEach((session, index) => {
      const createdAt = new Date(session.created_at);
      const timeAgo = Math.round((Date.now() - createdAt.getTime()) / 1000 / 60);
      
      console.log(`${index + 1}. Session ID: ${session.id}`);
      console.log(`   📧 Email: ${session.user_email}`);
      console.log(`   👤 Name: ${session.user_name || 'N/A'}`);
      console.log(`   🎯 Stage: ${session.stage}`);
      console.log(`   📈 Progress: ${session.progress}%`);
      console.log(`   🕐 Created: ${timeAgo} minutes ago`);
      console.log(`   📝 Skills: ${session.skills || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSessions().then(() => {
  console.log('✅ Session check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
