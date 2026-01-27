// Check chat history for reschedule conversation
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // Get chat history for Alex's conversation
    const { data: history } = await supabase
        .from('chat_history')
        .select('*')
        .eq('customer_phone', '+34683233450')
        .order('created_at', { ascending: false })
        .limit(20);
    
    console.log('Recent chat history:');
    for (const h of (history || []).reverse()) {
        console.log('\n---');
        console.log('Role:', h.role);
        console.log('Content:', h.content?.substring(0, 300));
        if (h.tool_calls) {
            console.log('Tool calls:', JSON.stringify(h.tool_calls, null, 2));
        }
    }
}
check();
