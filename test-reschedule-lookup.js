// Test reschedule booking lookup
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const phone = '+34683233450';
    const phoneWithPlus = phone;
    const phoneWithoutPlus = phone.replace(/^\+/, '');
    const today = new Date().toISOString().split('T')[0];
    const businessId = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
    
    console.log('Query params:');
    console.log('  phoneWithPlus:', phoneWithPlus);
    console.log('  phoneWithoutPlus:', phoneWithoutPlus);
    console.log('  today:', today);
    
    const { data, error } = await supabase
        .from('bookings')
        .select('id, slot_label, customer_phone, status, slot_date')
        .eq('business_id', businessId)
        .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
        .in('status', ['pending', 'confirmed', 'cancelled'])
        .gte('slot_date', today)
        .order('updated_at', { ascending: false })
        .limit(5);
    
    console.log('\nResults:', JSON.stringify(data, null, 2));
    console.log('Error:', error);
}
test();
