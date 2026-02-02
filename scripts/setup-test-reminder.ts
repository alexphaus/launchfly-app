// scripts/setup-test-reminder.ts
// Setup a test service record for 6-month service reminder testing
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// DANS business ID - same as feedback test
const DANS_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+639627459049'; // Same as 7-day feedback test

async function setup() {
    console.log('🔧 Setting up test data for 6-month service reminder...\n');
    
    // Find customer with test phone under DANS business
    const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id, name, phone, business_id')
        .eq('business_id', DANS_BUSINESS_ID)
        .or(`phone.eq.${TEST_PHONE},phone.eq.34683233450`)
        .single();
    
    let customerId: string;
    
    if (custErr || !customer) {
        console.log('❌ No customer found for DANS. Creating one...');
        
        const { data: newCust, error: createErr } = await supabase
            .from('customers')
            .insert({
                business_id: DANS_BUSINESS_ID,
                phone: TEST_PHONE,
                name: 'Alex Test',
                email: 'alex-test@launchfly.ai', // Required field
                status: 'completed',
            })
            .select()
            .single();
        
        if (createErr || !newCust) {
            console.error('Failed to create customer:', createErr);
            return;
        }
        console.log('✅ Created customer:', newCust.id);
        customerId = newCust.id;
    } else {
        console.log('✅ Found customer:', customer.id, customer.name);
        customerId = customer.id;
    }
    
    // Check for existing service record
    const { data: existing } = await supabase
        .from('service_records')
        .select('id, next_service_due_at, reminder_sent, reminder_count')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    // Calculate dates: service was 6 months ago, due TODAY
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(10, 0, 0, 0);
    
    const dueToday = new Date();
    dueToday.setHours(12, 0, 0, 0);
    
    // Warranty expired (was 30 days after service)
    const warrantyExpired = new Date(sixMonthsAgo);
    warrantyExpired.setDate(warrantyExpired.getDate() + 30);
    
    if (existing) {
        // Update existing record
        const { error } = await supabase
            .from('service_records')
            .update({ 
                service_date: sixMonthsAgo.toISOString(),
                next_service_due_at: dueToday.toISOString(),
                warranty_expires_at: warrantyExpired.toISOString(),
                reminder_sent: false,
                reminder_count: 0,
            })
            .eq('id', existing.id);
        
        if (error) {
            console.log('❌ Error updating:', error);
        } else {
            console.log('✅ Updated service record', existing.id);
            console.log('   Service date:', sixMonthsAgo.toISOString().split('T')[0], '(6 months ago)');
            console.log('   Next due:', dueToday.toISOString().split('T')[0], '(TODAY)');
            console.log('   Reminder sent: false');
        }
    } else {
        // Create new service record
        const { data: newRecord, error } = await supabase
            .from('service_records')
            .insert({
                business_id: DANS_BUSINESS_ID,
                customer_id: customerId,
                service_type: 'cleaning',
                service_name: 'Aircon General Cleaning',
                units_serviced: 2,
                warranty_days: 30,
                warranty_expires_at: warrantyExpired.toISOString(),
                service_interval_days: 180,
                next_service_due_at: dueToday.toISOString(),
                registered_via: 'manual',
                registered_by: 'system',
                service_date: sixMonthsAgo.toISOString(),
                reminder_sent: false,
                reminder_count: 0,
            })
            .select()
            .single();
        
        if (error) {
            console.log('❌ Error creating service record:', error);
        } else {
            console.log('✅ Created service record', newRecord.id);
            console.log('   Service date:', sixMonthsAgo.toISOString().split('T')[0], '(6 months ago)');
            console.log('   Next due:', dueToday.toISOString().split('T')[0], '(TODAY)');
        }
    }
    
    // Also update customer's next_reminder_due
    await supabase.from('customers').update({
        status: 'completed',
        next_reminder_due: dueToday.toISOString(),
    }).eq('id', customerId);
    
    console.log('\n💡 Now run: npx tsx scripts/test-reminder.ts');
}

setup().catch(console.error);
