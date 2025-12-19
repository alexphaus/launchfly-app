/**
 * Check Event PDF Data
 * This script checks what event-specific data is stored for a business
 * and shows what would be passed to the PDF generator.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkEventData(searchTerm = 'zumba') {
  console.log(`\n🔍 Searching for businesses containing: "${searchTerm}"\n`);
  
  // Find recent businesses
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, subdomain, business_data, form_data, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  // Filter locally for businesses matching the search term
  const filtered = businesses.filter(biz => {
    const data = biz.business_data || {};
    const searchFields = [
      biz.name,
      data.niche,
      data.lead_magnet_title,
      data.businessName,
      JSON.stringify(data)
    ].join(' ').toLowerCase();
    return searchFields.includes(searchTerm.toLowerCase());
  });
  
  if (filtered.length === 0) {
    console.log('❌ No businesses found matching:', searchTerm);
    console.log('   Showing 3 most recent businesses instead:\n');
    filtered.push(...businesses.slice(0, 3));
  }
  
  for (const biz of filtered) {
    console.log('═'.repeat(70));
    console.log(`📍 Business: ${biz.name || 'Unnamed'}`);
    console.log(`   ID: ${biz.id}`);
    console.log(`   Subdomain: ${biz.subdomain || 'none'}`);
    console.log(`   Created: ${new Date(biz.created_at).toLocaleString()}`);
    console.log('');
    
    const data = biz.business_data || {};
    const pdfContent = data.lead_magnet_pdf || {};
    
    console.log('📄 Design Preferences:');
    console.log(`   layout_mode: ${data.design_preferences?.layout_mode || 'NOT SET'}`);
    console.log(`   primary_color: ${data.design_preferences?.primary_color || 'NOT SET'}`);
    console.log('');
    
    console.log('🎫 Event-Specific Fields in PDF Content:');
    console.log(`   event_name: ${pdfContent.event_name || '❌ NOT SET'}`);
    console.log(`   event_details.date: ${pdfContent.event_details?.date || '❌ NOT SET'}`);
    console.log(`   event_details.time: ${pdfContent.event_details?.time || '❌ NOT SET'}`);
    console.log(`   event_details.venue: ${pdfContent.event_details?.venue || '❌ NOT SET'}`);
    console.log(`   event_details.pricing: ${JSON.stringify(pdfContent.event_details?.pricing) || '❌ NOT SET'}`);
    console.log(`   what_to_expect: ${pdfContent.what_to_expect ? `✅ ${pdfContent.what_to_expect.length} items` : '❌ NOT SET'}`);
    console.log(`   instructor_bio: ${pdfContent.instructor_bio ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   who_is_this_for: ${pdfContent.who_is_this_for ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   faq: ${pdfContent.faq ? `✅ ${pdfContent.faq.length} items` : '❌ NOT SET'}`);
    console.log('');
    
    console.log('📦 General Lead Magnet Data:');
    console.log(`   Title: ${data.lead_magnet_title || 'NOT SET'}`);
    console.log(`   Niche: ${data.niche || 'NOT SET'}`);
    console.log(`   BusinessType: ${data.businessType || 'NOT SET'}`);
    
    // Show what the PDF generator would receive
    console.log('\n🔧 What PDF Generator Would Receive:');
    const eventName = pdfContent.event_name || data.event_name || data.lead_magnet_title || 'Special Event';
    const eventDate = pdfContent.event_details?.date || data.event_date || 'Coming Soon';
    const eventTime = pdfContent.event_details?.time || data.event_time || '';
    const venue = pdfContent.event_details?.venue || data.venue || '';
    
    console.log(`   eventName: "${eventName}"`);
    console.log(`   eventDate: "${eventDate}"`);
    console.log(`   eventTime: "${eventTime}"`);
    console.log(`   venue: "${venue}"`);
    console.log('');
  }
  
  console.log('\n💡 If event fields show "NOT SET", you need to RE-ANALYZE the business');
  console.log('   using the Sales Tool to extract the new event-specific data.\n');
}

// Get search term from command line or default to 'zumba'
const searchTerm = process.argv[2] || 'zumba';
checkEventData(searchTerm);
