// scripts/setup-test-overdue.ts
// Setup a test service record for OVERDUE reminder testing (service is past due)
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// DANS business ID - same as other tests
const DANS_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+639627459049'; // Same as 7-day feedback test

async function setup() {
    console.log('🔧 Setting up test data for OVERDUE service reminder...\n');
    
    // Find customer with test phone under DANS business
    const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id, name, phone, business_id')
        .eq('business_id', DANS_BUSINESS_ID)
        .or(`phone.eq.${TEST_PHONE},phone.eq.639627459049`)
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
                email: 'alex-test@launchfly.ai',
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
    
    // Calculate dates: service was 7 months ago, OVERDUE by 1 month
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    sevenMonthsAgo.setHours(10, 0, 0, 0);
    
    // Due date was 1 month ago (overdue!)
    const overdueDate = new Date();
    overdueDate.setMonth(overdueDate.getMonth() - 1);
    overdueDate.setHours(12, 0, 0, 0);
    
    // Warranty expired long ago
    const warrantyExpired = new Date(sevenMonthsAgo);
    warrantyExpired.setDate(warrantyExpired.getDate() + 30);
    
    if (existing) {
        // Update existing record
        const { error } = await supabase
            .from('service_records')
            .update({ 
                service_date: sevenMonthsAgo.toISOString(),
                next_service_due_at: overdueDate.toISOString(),
                warranty_expires_at: warrantyExpired.toISOString(),
                reminder_sent: false,
                reminder_count: 1, // Already sent 1 reminder (due), now sending overdue
            })
            .eq('id', existing.id);
        
        if (error) {
            console.log('❌ Error updating:', error);
        } else {
            console.log('✅ Updated service record', existing.id);
            console.log('   Service date:', sevenMonthsAgo.toISOString().split('T')[0], '(7 months ago)');
            console.log('   Was due:', overdueDate.toISOString().split('T')[0], '(1 MONTH OVERDUE!)');
            console.log('   Reminder count: 1 (simulating 2nd reminder)');
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
                next_service_due_at: overdueDate.toISOString(),
                registered_via: 'manual',
                registered_by: 'system',
                service_date: sevenMonthsAgo.toISOString(),
                reminder_sent: false,
                reminder_count: 1,
            })
            .select()
            .single();
        
        if (error) {
            console.log('❌ Error creating service record:', error);
        } else {
            console.log('✅ Created service record', newRecord.id);
            console.log('   Service date:', sevenMonthsAgo.toISOString().split('T')[0], '(7 months ago)');
            console.log('   Was due:', overdueDate.toISOString().split('T')[0], '(1 MONTH OVERDUE!)');
        }
    }
    
    // Update customer status
    await supabase.from('customers').update({
        status: 'completed',
        next_reminder_due: overdueDate.toISOString(),
    }).eq('id', customerId);
    
    console.log('\n💡 Now run: npx tsx scripts/test-overdue-direct.ts --send');
}

setup().catch(console.error);
