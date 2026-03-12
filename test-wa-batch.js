const { getCredentials } = require('./src/lib/ultramsg.ts');
require('dotenv').config({path: '.env.local'});
async function run() {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  
  const start = Date.now();
  for(let i=0; i<5; i++) {
    const p = "+6013276159" + i + "@c.us";
    const pfmt = p.replace(/\D/g, '') + "@c.us";
    await fetch(`https://api.ultramsg.com/${instanceId}/contacts/check?token=${token}&chatId=${pfmt}`).then(r => r.json());
  }
  console.log('Time 5 sync:', Date.now() - start);
  
  const start2 = Date.now();
  await Promise.all([0,1,2,3,4].map(async i => {
    const p = "+6013276159" + i + "@c.us";
    const pfmt = p.replace(/\D/g, '') + "@c.us";
    return fetch(`https://api.ultramsg.com/${instanceId}/contacts/check?token=${token}&chatId=${pfmt}`).then(r => r.json());
  }));
  console.log('Time 5 async:', Date.now() - start2);
}
run();
