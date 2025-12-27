'use server'

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with Service Role Key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function saveLead(formData: FormData) {
  const businessName = formData.get('businessName') as string;
  const phone = formData.get('phone') as string;
  const service = formData.get('service') as string;
  const area = formData.get('area') as string;

  if (!businessName || !phone || !service || !area) {
    return { error: 'All fields are required' };
  }

  // Ensure phone number is clean for storage if needed, but keeping raw input is fine too.
  // Let's just trim it.
  const cleanPhone = phone.trim();

  const { data, error } = await supabase
    .from('leads')
    .insert([
      {
        business_name: businessName,
        phone: cleanPhone,
        service: service,
        area: area,
        status: 'contacted' // We assume the user clicks the button to send the message immediately
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving lead:', error);
    return { error: error.message };
  }

  return { success: true, lead: data };
}

export async function getRecentLeads() {
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        // If table doesn't exist yet, return empty array instead of crashing
        console.error('Error fetching leads (table might not exist yet):', error);
        return [];
    }
    return data;
}
