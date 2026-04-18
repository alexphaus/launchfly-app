import 'dotenv/config';
import fs from 'fs';

async function main() {
  console.log('🔎 Searching for a reliable RTX 4090 on Vast.ai (Strict NAT checks)...');
  const apiKey = process.env.VASTAI_API_KEY;
  const vastHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  
  const searchQ = encodeURIComponent(JSON.stringify({
    gpu_name: { eq: 'RTX 4090' }, 
    num_gpus: { eq: 1 }, 
    rented: { eq: false },
    type: 'on-demand'
  }));
  
  const searchUrl = `https://console.vast.ai/api/v0/bundles/?api_key=${apiKey}&q=${searchQ}`;
  const res = await fetch(searchUrl, { headers: vastHeaders });
  const data = await res.json();
  const offers = data.offers || [];
  
  let validOffers = offers.filter(o => {
    if (o.direct_port_count < 1) return false;
    if (o.disk_space < 40) return false;
    if (o.geolocation && (o.geolocation.includes('CN') || o.geolocation.includes('RU'))) return false;
    // IMPORTANT: Reject misconfigured hosts that report LAN IP addresses
    const pip = o.public_ipaddr;
    if (!pip || pip.startsWith('192.168.') || pip.startsWith('10.') || pip.startsWith('172.')) return false;
    return true;
  });
  
  validOffers.sort((a,b) => a.dph_total - b.dph_total);
  
  let rentedId = null;
  
  for (let i = 0; i < Math.min(10, validOffers.length); i++) {
    const offer = validOffers[i];
    console.log(`\n▶️ Attempting ${offer.id} ($${offer.dph_total?.toFixed(4)}, IP: ${offer.public_ipaddr}, DL: ${Math.round(offer.inet_down)}Mbps)`);
    
    const rentUrl = `https://console.vast.ai/api/v0/asks/${offer.id}/?api_key=${apiKey}`;
    const createPayload = {
      client_id: 'me',
      image: 'yanwk/comfyui-boot:cu126-megapak',
      disk: 40,
      label: 'launchfly-persistent',
      onstart: 'mkdir -p /root/ComfyUI/models/checkpoints && wget -qO /root/ComfyUI/models/checkpoints/ltxv-2b-0.9.8-distilled-fp8.safetensors https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltxv-2b-0.9.8-distilled-fp8.safetensors',
      env: { '-p': '8188:8188' },
    };
    
    const rentRes = await fetch(rentUrl, {
      method: 'PUT',
      headers: vastHeaders,
      body: JSON.stringify(createPayload)
    });
    
    if (rentRes.ok) {
      const parsed = await rentRes.json();
      if (parsed.new_contract) {
        rentedId = parsed.new_contract;
        console.log(`   🎉 Successfully rented Instance ID: ${rentedId}`);
        break;
      }
    }
  }
  
  if (!rentedId) {
    console.log('\n❌ All top instances failed to rent.');
    return;
  }
  
  let envStr = fs.readFileSync('.env', 'utf-8');
  if (envStr.includes('VAST_INSTANCE_ID=')) {
    envStr = envStr.replace(/VAST_INSTANCE_ID=.*/g, `VAST_INSTANCE_ID=${rentedId}`);
  }
  fs.writeFileSync('.env', envStr);
  console.log(`\n📝 Updated .env with new VAST_INSTANCE_ID = ${rentedId}`);
}
main().catch(console.error);
