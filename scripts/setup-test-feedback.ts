// scripts/setup-test-feedback.ts
// Setup a test service record for 7-day feedback testing
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function setup() {
    console.log('🔧 Setting up test data for 7-day feedback...\n');
    
    // Get one of the recent service records
    const { data: record } = await supabase
        .from('service_records')
        .select('id, customer_id, business_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (!record) {
        console.log('❌ No service records found to update');
        return;
    }
    
    // Set service_date to exactly 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(10, 0, 0, 0); // 10am
    
    const { error } = await supabase
        .from('service_records')
        .update({ 
            service_date: sevenDaysAgo.toISOString(),
            feedback_request_sent_at: null // Reset so it can be sent
        })
        .eq('id', record.id);
    
    if (error) {
        console.log('❌ Error updating:', error);
    } else {
        console.log('✅ Updated service record', record.id);
        console.log('   New service_date:', sevenDaysAgo.toISOString().split('T')[0]);
        console.log('\n💡 Now run: npx tsx scripts/test-7d-feedback.ts');
    }
}

setup().catch(console.error);
