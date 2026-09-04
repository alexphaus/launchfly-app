// Generates VAPID keys for Copilot push. Run once: node scripts/copilot-vapid.mjs
// Put the output in your environment; never commit the private key.
import webpush from 'web-push';
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`COPILOT_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`COPILOT_VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`COPILOT_VAPID_SUBJECT=mailto:you@example.com`);
