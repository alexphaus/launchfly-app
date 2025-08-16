// Debug script to check recent Stripe sessions
const https = require('https');

console.log('Checking recent checkout sessions for debugging...');

// Simple test to see if checkout sessions are being created with correct metadata
async function checkRecentSessions() {
  console.log('This would require Stripe API key to check actual sessions.');
  console.log('In development, the issue is that webhooks don\'t fire automatically.');
  console.log('\nFor testing multi-item purchases:');
  console.log('1. Complete a multi-item purchase');
  console.log('2. Note the session ID from the success page');
  console.log('3. Run the manual revenue update script');
  
  console.log('\nTo fix this properly for production:');
  console.log('1. Set up ngrok for local webhook testing: ngrok http 3000');
  console.log('2. Add the ngrok URL to Stripe webhook settings');
  console.log('3. Configure STRIPE_WEBHOOK_SECRET in environment variables');
}

checkRecentSessions();
