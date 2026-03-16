import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testRetell() {
  const retellApiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID || process.env.RETELL_DEFAULT_AGENT_ID;
  const fromNumber = process.env.RETELL_FROM_NUMBER || process.env.RETELL_DEFAULT_FROM_NUMBER;
  
  // Replace with your phone number for testing
  const toNumber = '+34683233450'; 
  
  console.log('Testing Retell call to:', toNumber);
  console.log('Using Agent ID:', agentId);
  console.log('From:', fromNumber);

  try {
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: toNumber,
        agent_id: agentId,
        retell_llm_dynamic_variables: {
          customer_name: 'Alex Test',
          business_name: 'Launchfly Test',
          lead_id: 'test-123',
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Call failed:', errBody);
      return;
    }

    const data = await res.json();
    console.log('Success! Call created:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testRetell();
