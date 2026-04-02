const { Client } = require('@upstash/qstash');
const client = new Client({ token: 'eyJVc2VySUQiOiIwNjNjZTM1YS02MmEyLTQ4MDQtYjljMC05YzRkNWUxN2JlYjUiLCJQYXNzd29yZCI6ImYyMDhhYTY5MzJmMjQ3ZmVhYTgyZWQwYjExN2YxZDg5In0=' });

async function check() {
  try {
    // try to list messages or events
    let method = Object.keys(client);
    console.log("Client methods:", method);
    
    // Check if there is a 'messages' object
    if (client.messages) {
       console.log("Messages methods:", Object.keys(client.messages));
    }
    
    // Check events
    const events = await client.events();
    console.log(`Found ${events.length || 0} recent events`);
    
  } catch(e) {
    console.error(e);
  }
}
check();
