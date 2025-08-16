// Manual revenue update script for testing
const https = require('https');

// Simulate a Stripe webhook call to update revenue
function simulateWebhook() {
  const webhookData = {
    id: 'evt_test_webhook',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_b1geitCyEkVHGHIsAzEPm2gTk2AqKMkDg20k1OSVPZ2b3EA6IW1vRhpH4K', // From your transaction
        amount_total: 13596, // $135.96 in cents
        currency: 'usd',
        metadata: {
          business_id: '402430fd-cd98-4fe7-a5e7-700c85bd2786' // moderngrind business ID
        },
        customer_details: {
          email: 'axpg31@gmail.com',
          name: 'Ax'
        }
      }
    }
  };

  const postData = JSON.stringify(webhookData);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/stripe/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'stripe-signature': 'test_signature' // This will fail validation but let's see
    }
  };

  const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (error) => {
    console.error(error);
  });

  req.write(postData);
  req.end();
}

console.log('Simulating Stripe webhook for revenue update...');
simulateWebhook();
