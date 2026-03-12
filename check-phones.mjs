import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check what phones were actually sent to
const { data: msgs } = await s.from('chat_history')
  .select('phone, content, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('role', 'assistant')
  .order('created_at');

console.log('=== Messages sent via WhatsApp ===\n');
for (const m of msgs) {
  const p = m.phone;
  // What country does WhatsApp think this is?
  let interp = '??';
  if (p.startsWith('(800)') || p.startsWith('(866)') || p.startsWith('(323)') || p.startsWith('(')) interp = 'RAW US FORMAT (not intl)';
  else if (/^\+1\d{10}$/.test(p)) interp = 'US/CA (correct)';
  else if (p.startsWith('+60')) interp = 'Malaysia (correct)';
  else if (p.startsWith('+34')) interp = 'Spain';
  else if (p.startsWith('+91')) interp = 'INDIA (wrong!)';
  else if (p.startsWith('+55')) interp = 'BRAZIL (wrong!)';
  else if (p.startsWith('+73')) interp = 'RUSSIA (wrong!)';
  else if (p.startsWith('+80')) interp = 'TOLL-FREE (wrong!)';
  else if (p.startsWith('+81')) interp = 'JAPAN (wrong!)';
  else if (p.startsWith('+64')) interp = 'NZ (wrong!)';
  else if (p.startsWith('+21')) interp = 'NORTH AFRICA (wrong!)';
  else if (p.startsWith('+')) {
    // US numbers without country code: +9177054571 is NOT +1-917-705-4571
    const digits = p.replace(/[^\d]/g, '');
    if (digits.length === 10) interp = 'US NUMBER MISSING +1 PREFIX!';
    else interp = 'Unknown cc=' + p.substring(0, 4);
  }
  else interp = 'Raw: ' + p.substring(0, 10);
  
  console.log(`  ${p.padEnd(20)} → ${interp}`);
}

// Also check quote_leads phones
console.log('\n=== Phones stored in quote_leads ===\n');
const { data: leads } = await s.from('quote_leads')
  .select('name, phone')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .order('created_at');
for (const l of leads || []) {
  const digits = l.phone.replace(/[^\d]/g, '');
  const needsCountryCode = digits.length === 10 && !l.phone.startsWith('+1');
  console.log(`  ${l.phone.padEnd(16)} ${needsCountryCode ? '⚠️  NEEDS +1' : '✅'} | ${l.name}`);
}
