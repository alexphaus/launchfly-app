// scripts/check-jan-data.ts
// Check what data exists for January 2026

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const businessId = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';

// January 2026 range
const start = '2026-01-01T00:00:00.000Z';
const end = '2026-01-31T23:59:59.999Z';

async function check() {
    console.log('📊 Checking data for January 2026...\n');

    // Check customers
    const { count: custCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);
    console.log('👥 Customers created in Jan 2026:', custCount);

    // Check service_records
    const { count: svcCount } = await supabase
        .from('service_records')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);
    console.log('🔧 Service records created in Jan 2026:', svcCount);

    // Check bookings
    const { count: bookCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);
    console.log('📅 Bookings created in Jan 2026:', bookCount);

    // Check ALL customers (not just January)
    const { count: totalCust } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId);
    console.log('\n📈 TOTAL customers (all time):', totalCust);

    // Check ALL service_records (not just January)
    const { count: totalSvc } = await supabase
        .from('service_records')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId);
    console.log('📈 TOTAL service_records (all time):', totalSvc);

    // Check when customers were created
    const { data: recentCust } = await supabase
        .from('customers')
        .select('first_name, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('\n🕐 Most recent customers:');
    recentCust?.forEach(c => console.log('   ', c.first_name, '-', c.created_at));

    // Check when service_records were created
    const { data: recentSvc } = await supabase
        .from('service_records')
        .select('service_date, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('\n🕐 Most recent service_records:');
    recentSvc?.forEach(s => console.log('   ', s.service_date, '-', s.created_at));
}

check().catch(console.error);
