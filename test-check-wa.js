const { getCredentials } = require('./src/lib/ultramsg.ts');
// Actually, let's just make a fetch directly with env vars
require('dotenv').config({path: '.env.local'});
async function run() {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  const num1 = "+60132761590"; // real
  const num2 = "+6013276159112"; // fake
  
  const p1 = num1.replace(/\D/g, '') + "@c.us";
  const p2 = num2.replace(/\D/g, '') + "@c.us";
  
  const res1 = await fetch(`https://api.ultramsg.com/${instanceId}/contacts/check?token=${token}&chatId=${p1}`);
  console.log('Real:', await res1.json());
  
  const res2 = await fetch(`https://api.ultramsg.com/${instanceId}/contacts/check?token=${token}&chatId=${p2}`);
  console.log('Fake:', await res2.json());
  
}
run();
