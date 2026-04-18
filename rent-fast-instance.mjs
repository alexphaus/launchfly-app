import 'dotenv/config';
import fs from 'fs';

const API = 'https://console.vast.ai/api/v0';
const KEY = process.env.VASTAI_API_KEY;
const headers = { 'Authorization': `Bearer ${KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Lean onstart script — installs ComfyUI + LTX model
const ONSTART = `#!/bin/bash
set -e
apt-get update && apt-get install -y git wget openssh-server
# ComfyUI
if [ ! -d /workspace/ComfyUI ]; then
  cd /workspace && git clone https://github.com/comfyanonymous/ComfyUI.git
  cd ComfyUI && pip install -r requirements.txt
fi
# LTX-Video checkpoint
mkdir -p /workspace/ComfyUI/models/checkpoints
if [ ! -f /workspace/ComfyUI/models/checkpoints/ltx-video-2b-v0.9.5.safetensors ]; then
  wget -q --show-progress -O /workspace/ComfyUI/models/checkpoints/ltx-video-2b-v0.9.5.safetensors "https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltx-video-2b-v0.9.5.safetensors"
fi
# T5 text encoder
mkdir -p /workspace/ComfyUI/models/text_encoders
if [ ! -f /workspace/ComfyUI/models/text_encoders/t5xxl_fp16.safetensors ]; then
  wget -q --show-progress -O /workspace/ComfyUI/models/text_encoders/t5xxl_fp16.safetensors "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors"
fi
# Start ComfyUI
cd /workspace/ComfyUI && python main.py --listen 0.0.0.0 --port 8188 &
`;

async function main() {
  console.log('Searching for fast RTX 4090 hosts...\n');

  const query = JSON.stringify({
    gpu_name: { eq: 'RTX 4090' },
    num_gpus: { eq: 1 },
    rented: { eq: false },
    type: 'on-demand',
    inet_down: { gte: 500 },
    disk_space: { gte: 60 }
  });

  const res = await fetch(`${API}/bundles/?api_key=${KEY}&q=${encodeURIComponent(query)}`, { headers });
  const data = await res.json();
  const offers = data.offers || [];

  // Filter for public IPs
  const valid = offers.filter(o => {
    if (!o.public_ipaddr) return false;
    if (o.public_ipaddr.startsWith('192.168.')) return false;
    if (o.public_ipaddr.startsWith('10.')) return false;
    if (o.public_ipaddr.startsWith('172.16.')) return false;
    if (o.direct_port_count < 1) return false;
    return true;
  });

  valid.sort((a, b) => a.dph_total - b.dph_total);
  console.log(`Found ${valid.length} valid fast offers\n`);

  if (!valid.length) { console.log('No valid offers'); return; }

  // Show top 5
  valid.slice(0, 5).forEach(x => {
    console.log(`  ${x.id}: $${x.dph_total.toFixed(3)}/hr, ${Math.round(x.inet_down)}Mbps DL, ${Math.round(x.disk_space)}GB disk, ${x.geolocation}, IP: ${x.public_ipaddr}`);
  });

  // Use a small CUDA image that's commonly cached
  const IMAGE = 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime';

  let rentedId = null;
  for (const offer of valid.slice(0, 5)) {
    console.log(`\nTrying ${offer.id}...`);
    const payload = {
      client_id: 'me',
      image: IMAGE,
      disk: 60,
      onstart: ONSTART,
      env: { '-p 8188:8188': '1' },
      runtype: 'ssh_direc ssh_proxy',
      image_login: null,
    };

    const r = await fetch(`${API}/asks/${offer.id}/?api_key=${KEY}`, {
      method: 'PUT', headers, body: JSON.stringify(payload)
    });

    if (r.ok) {
      const p = await r.json();
      if (p.new_contract) {
        rentedId = p.new_contract;
        console.log(`Rented: ${rentedId}`);
        break;
      }
    } else {
      console.log(`Failed: ${(await r.text()).substring(0, 80)}`);
    }
  }

  if (!rentedId) { console.log('All failed'); return; }

  let env = fs.readFileSync('.env', 'utf-8');
  env = env.includes('VAST_INSTANCE_ID=')
    ? env.replace(/VAST_INSTANCE_ID=.*/g, `VAST_INSTANCE_ID=${rentedId}`)
    : env + `\nVAST_INSTANCE_ID=${rentedId}\n`;
  fs.writeFileSync('.env', env);
  console.log(`Saved VAST_INSTANCE_ID=${rentedId} to .env`);
}

main().catch(console.error);
