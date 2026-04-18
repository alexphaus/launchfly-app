import 'dotenv/config';
import fs from 'fs';

async function main() {
  console.log('🔎 Searching for a reliable RTX 4090 on Vast.ai...');
  const apiKey = process.env.VASTAI_API_KEY;
  const vastHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const getUrl = (p) => `https://console.vast.ai/api/v0${p}?api_key=${encodeURIComponent(apiKey)}`;

  const searchQ = encodeURIComponent(JSON.stringify({
    gpu_name: { eq: 'RTX 4090' }, 
    num_gpus: { eq: 1 }, 
    rented: { eq: false },
    type: 'on-demand'
  }));
  
  const res = await fetch(getUrl(`/bundles/?q=${searchQ}`), { headers: vastHeaders });
  const data = await res.json();
  const offers = data.offers || [];
  
  // Custom filter logic
  const filtered = offers.filter(o => 
    o.direct_port_count >= 1 &&
    o.disk_space >= 40 &&
    (!o.geolocation || (!o.geolocation.includes('CN') && !o.geolocation.includes('RU')))
  );
  
  // Sort by price specifically to be cheap
  filtered.sort((a,b) => a.dph_total - b.dph_total);
  
  if (!filtered.length) {
    console.log('❌ No valid offers found.');
    return;
  }
  
  let rentedId = null;
  // Try to rent one
  for (let i = 0; i < Math.min(5, filtered.length); i++) {
    const offer = filtered[i];
    console.log(`\n▶️ Attempting ${offer.id} ($${offer.dph_total?.toFixed(4)}, DL: ${Math.round(offer.inet_down)}Mbps, Geo: ${offer.geolocation})`);
    
    // Explicitly add 'onstart' missing from last one due to assignment error
    const createPayload = {
      client_id: 'me',
      image: 'yanwk/comfyui-boot:cu126-megapak',
      disk: 40,
      label: 'launchfly-persistent',
      onstart: 'mkdir -p /root/ComfyUI/models/checkpoints && wget -qO /root/ComfyUI/models/checkpoints/ltxv-2b-0.9.8-distilled-fp8.safetensors https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltxv-2b-0.9.8-distilled-fp8.safetensors',
      env: { '-p': '8188:8188' },
    };
    
    const rentRes = await fetch(getUrl(`/asks/${offer.id}/`), {
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
    } else {
      console.error('   ❌ Rent failed:', await rentRes.text());
    }
  }
  
  if (!rentedId) {
    console.log('\n❌ All top instances failed to rent.');
    return;
  }
  
  let envStr = fs.readFileSync('.env', 'utf-8');
  if (envStr.includes('VAST_INSTANCE_ID=')) {
    envStr = envStr.replace(/VAST_INSTANCE_ID=.*/g, `VAST_INSTANCE_ID=${rentedId}`);
  } else {
    envStr += `\nVAST_INSTANCE_ID=${rentedId}\n`;
  }
  fs.writeFileSync('.env', envStr);
  console.log(`📝 Updated .env with new VAST_INSTANCE_ID = ${rentedId}`);
}
main();
