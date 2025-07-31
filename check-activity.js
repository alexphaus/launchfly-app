require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRecentActivity() {
  console.log('🔍 Checking recent activity across all tables...\n');
  
  try {
    // Check sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sessionError) {
      console.error('❌ Error fetching sessions:', sessionError);
    } else {
      console.log(`📋 Sessions (${sessions?.length || 0} recent):`);
      sessions?.forEach((session, index) => {
        const timeAgo = Math.round((Date.now() - new Date(session.created_at).getTime()) / 1000 / 60);
        console.log(`  ${index + 1}. ${session.id} - ${session.stage} (${session.progress}%) - ${timeAgo}m ago`);
        if (session.user_email) console.log(`     📧 ${session.user_email}`);
        if (session.user_name) console.log(`     👤 ${session.user_name}`);
        if (session.skills) console.log(`     🎯 ${session.skills}`);
      });
      console.log('');
    }
    
    // Check businesses
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (businessError) {
      console.error('❌ Error fetching businesses:', businessError);
    } else {
      console.log(`🏢 Businesses (${businesses?.length || 0} recent):`);
      businesses?.forEach((business, index) => {
        const timeAgo = Math.round((Date.now() - new Date(business.created_at).getTime()) / 1000 / 60);
        console.log(`  ${index + 1}. ${business.name} - Session: ${business.session_id} - ${timeAgo}m ago`);
        console.log(`     📝 ${business.description?.substring(0, 80)}...`);
      });
      console.log('');
    }
    
    // Check for any errors in recent sessions
    const { data: errorSessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('stage', 'error')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (errorSessions && errorSessions.length > 0) {
      console.log(`❌ Error Sessions (${errorSessions.length} recent):`);
      errorSessions.forEach((session, index) => {
        const timeAgo = Math.round((Date.now() - new Date(session.created_at).getTime()) / 1000 / 60);
        console.log(`  ${index + 1}. ${session.id} - ${timeAgo}m ago`);
        console.log(`     📧 ${session.user_email || 'No email'}`);
        console.log(`     📈 Progress: ${session.progress}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRecentActivity().then(() => {
  console.log('✅ Activity check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
