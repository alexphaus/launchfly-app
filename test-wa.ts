import { getWhatsAppProvider } from './src/lib/whatsapp-provider';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function test() {
  const businessId = process.argv[2];
  if (!businessId) {
    console.error('Usage: tsx test-wa.ts <businessId>');
    process.exit(1);
  }

  try {
    const provider = await getWhatsAppProvider(businessId);
    console.log(`Resolved Provider:`, provider.name);
    console.log(`Has sendWhatsApp?`, typeof provider.sendWhatsApp === 'function');
    
    // We won't actually send a message to avoid spamming, but we can check if it has the number
    // We'll check the owner's phone or a fake number
    if (provider.name === 'evolution') {
       console.log('Provider is Evolution. Credentials must be present.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
