import 'dotenv/config';
import fs from 'fs';

const API = 'https://console.vast.ai/api/v0';
const KEY = process.env.VASTAI_API_KEY;
const headers = { 'Authorization': `Bearer ${KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

// On-start script that installs ComfyUI + LTX Video model
const ONSTART_SCRIPT = `#!/bin/bash
set -e

# Install ComfyUI if not already present
if [ ! -d /workspace/ComfyUI ]; then
  echo "=== Installing ComfyUI ==="
  cd /workspace
  git clone https://github.com/comfyanonymous/ComfyUI.git
  cd ComfyUI
  pip install -r requirements.txt
  
  # Install ComfyUI-Manager
  cd custom_nodes
  git clone https://github.com/ltdrdata/ComfyUI-Manager.git
  cd ..
fi

# Download LTX-Video model if not present
MODEL_DIR="/workspace/ComfyUI/models/checkpoints"
mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_DIR/ltx-video-2b-v0.9.5.safetensors" ]; then
  echo "=== Downloading LTX-Video model ==="
  cd "$MODEL_DIR"
  wget -q --show-progress "https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltx-video-2b-v0.9.5.safetensors"
fi

# Download T5 text encoder if not present
T5_DIR="/workspace/ComfyUI/models/text_encoders"
mkdir -p "$T5_DIR"
if [ ! -f "$T5_DIR/t5xxl_fp16.safetensors" ]; then
  echo "=== Downloading T5-XXL text encoder ==="
  cd "$T5_DIR"
  wget -q --show-progress "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors"
fi

# Start ComfyUI
echo "=== Starting ComfyUI ==="
cd /workspace/ComfyUI
python main.py --listen 0.0.0.0 --port 8188 &
`;

async function main() {
  console.log('🔎 Searching for a reliable RTX 4090 on Vast.ai...\n');

  // Search for available offers
  const query = JSON.stringify({
    gpu_name: { eq: 'RTX 4090' },
    num_gpus: { eq: 1 },
    rented: { eq: false },
    type: 'on-demand'
  });
  const url = `${API}/bundles/?api_key=${KEY}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  const offers = data.offers || [];
  console.log(`Found ${offers.length} raw offers`);

  // Filter: public IP (not 192.168.x.x), enough disk, direct ports, not CN/RU
  const valid = offers.filter(o => {
    if (o.disk_space < 60) return false; // Need at least 60GB for models
    if (o.direct_port_count < 1) return false;
    if (o.inet_down < 200) return false;
    if (o.geolocation && (o.geolocation.includes('CN') || o.geolocation.includes('RU'))) return false;
    // Check for private IPs
    if (o.public_ipaddr && (
      o.public_ipaddr.startsWith('192.168.') || 
      o.public_ipaddr.startsWith('10.') || 
      o.public_ipaddr.startsWith('172.16.')
    )) return false;
    return true;
  });
  
  // Sort by price
  valid.sort((a, b) => a.dph_total - b.dph_total);
  console.log(`${valid.length} valid offers after filtering\n`);

  if (!valid.length) {
    console.log('❌ No valid offers found.');
    return;
  }

  // Try to rent one of the top 5 cheapest
  let rentedId = null;
  for (const offer of valid.slice(0, 5)) {
    console.log(`▶️  Attempting ${offer.id} ($${offer.dph_total.toFixed(3)}/hr, IP: ${offer.public_ipaddr || 'N/A'}, DL: ${Math.round(offer.inet_down)}Mbps, Geo: ${offer.geolocation || 'N/A'}, Disk: ${Math.round(offer.disk_space)}GB)`);

    const createPayload = {
      client_id: 'me',
      image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel',
      disk: 60,
      onstart: ONSTART_SCRIPT,
      env: { JUPYTER_DIR: '/workspace' },
      runtype: 'ssh_direc ssh_proxy',
    };

    const rentRes = await fetch(`${API}/asks/${offer.id}/?api_key=${KEY}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(createPayload)
    });

    if (rentRes.ok) {
      const parsed = await rentRes.json();
      if (parsed.new_contract) {
        rentedId = parsed.new_contract;
        console.log(`   🎉 Successfully rented Instance ID: ${rentedId}`);
        break;
      } else {
        console.log(`   ⚠️  Response: ${JSON.stringify(parsed).substring(0, 100)}`);
      }
    } else {
      console.error(`   ❌ Rent failed: ${(await rentRes.text()).substring(0, 100)}`);
    }
  }

  if (!rentedId) {
    console.log('\n❌ All attempts failed.');
    return;
  }

  // Update .env
  let envStr = fs.readFileSync('.env', 'utf-8');
  if (envStr.includes('VAST_INSTANCE_ID=')) {
    envStr = envStr.replace(/VAST_INSTANCE_ID=.*/g, `VAST_INSTANCE_ID=${rentedId}`);
  } else {
    envStr += `\nVAST_INSTANCE_ID=${rentedId}\n`;
  }
  fs.writeFileSync('.env', envStr);
  console.log(`\n📝 Updated .env with VAST_INSTANCE_ID=${rentedId}`);
}

main().catch(console.error);
