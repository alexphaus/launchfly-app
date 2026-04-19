#!/usr/bin/env node
/**
 * Vast.ai GPU Instance Setup — LTX Video 2.3 + ComfyUI
 * 
 * One-command setup for a fresh Vast.ai instance with everything needed:
 *   - Finds cheapest 40GB+ VRAM GPU
 *   - Rents instance with correct port mapping + onstart script
 *   - Registers SSH key
 *   - Waits for boot + ComfyUI health
 *   - Downloads all 3 models (~58GB total) from correct repos
 *   - Installs custom nodes (ComfyUI-LTXVideo, video-concat)
 *   - Restarts ComfyUI, verifies everything works
 *   - Updates .env and .env.local with new instance ID
 * 
 * Usage:
 *   node setup-vast-gpu.mjs                    # Auto-find cheapest GPU
 *   node setup-vast-gpu.mjs --offer 19075155   # Use specific offer ID
 *   node setup-vast-gpu.mjs --instance 35204200 # Re-setup existing instance (skip rent)
 *   node setup-vast-gpu.mjs --dry-run           # Show what would happen
 * 
 * Requires: VASTAI_API_KEY in .env or .env.local
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

const API_KEY = process.env.VASTAI_API_KEY;
if (!API_KEY) { console.error('❌ VASTAI_API_KEY not set in .env'); process.exit(1); }

const VAST_BASE = 'https://console.vast.ai/api/v0';
const AUTH = `api_key=${encodeURIComponent(API_KEY)}`;
const HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

// ─── Config ──────────────────────────────────────────────────────────────

const MIN_VRAM_GB = 40;        // LTX 2.3 22B FP8 needs ~40GB
const MIN_DISK_GB = 100;       // Models are ~58GB + ComfyUI ~10GB
const MAX_PRICE_PER_HR = 0.60; // Budget cap
const PREFERRED_GPUS = ['A40', 'A100', 'A6000', 'L40', 'L40S', 'A100 SXM', 'H100'];

// Model URLs (verified working — these are the CORRECT repos!)
const MODELS = {
  checkpoint: {
    url: 'https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors',
    dest: 'models/checkpoints/ltx-2.3-22b-dev-fp8.safetensors',
    size: '29.1 GB',
  },
  lora: {
    url: 'https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-22b-distilled-lora-384-1.1.safetensors',
    dest: 'models/loras/ltx-2.3-22b-distilled-lora-384-1.1.safetensors',
    size: '7.6 GB',
  },
  textEncoder: {
    // NOTE: comfyanonymous/comfy_gemma is GATED (401). Use artokun's ungated mirror instead.
    // We save it as comfy_gemma_3_12B_it.safetensors to match tools.ts constant.
    url: 'https://huggingface.co/artokun/comfy_gemma_3_12B_it_abliterated/resolve/main/comfy_gemma_3_12B_it_abliterated.safetensors',
    dest: 'models/text_encoders/comfy_gemma_3_12B_it.safetensors',
    size: '23 GB',
  },
};

// Onstart script — runs every time the instance boots
const ONSTART_SCRIPT = `#!/bin/bash
cd /workspace/ComfyUI
nohup python main.py --listen 0.0.0.0 --port 8188 > /workspace/comfyui.log 2>&1 &
echo "ComfyUI started at $(date)" >> /workspace/startup.log
`;

// Video concat extension for generate_long_video stitching
const CONCAT_EXTENSION = `import os
import subprocess
import uuid
from aiohttp import web
from server import PromptServer

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "output")

@PromptServer.instance.routes.post("/concat_videos")
async def concat_videos(request):
    data = await request.json()
    files = data.get("files", [])
    if len(files) < 2:
        return web.json_response({"error": "Need at least 2 files"}, status=400)
    for f in files:
        path = os.path.join(OUTPUT_DIR, f)
        if not os.path.isfile(path):
            return web.json_response({"error": f"File not found: {f}"}, status=404)
    output_name = f"concat_{uuid.uuid4().hex[:8]}.mp4"
    output_path = os.path.join(OUTPUT_DIR, output_name)
    concat_list = f"/tmp/concat_{uuid.uuid4().hex[:8]}.txt"
    try:
        with open(concat_list, "w") as cl:
            for f in files:
                cl.write(f"file '{os.path.join(OUTPUT_DIR, f)}'\\n")
        result = subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", output_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return web.json_response({"error": f"ffmpeg error: {result.stderr[:500]}"}, status=500)
    except subprocess.TimeoutExpired:
        return web.json_response({"error": "ffmpeg timed out after 120s"}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
    finally:
        try:
            os.unlink(concat_list)
        except OSError:
            pass
    return web.json_response({"filename": output_name, "subfolder": "", "type": "output"})

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────

const vastUrl = (path) => {
  const sep = path.includes('?') ? '&' : '?';
  return `${VAST_BASE}${path}${sep}${AUTH}`;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const elapsed = (start) => `${((Date.now() - start) / 1000).toFixed(1)}s`;

function ssh(cmd, { timeout = 30000 } = {}) {
  const sshCmd = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 -p ${sshPort} root@${sshHost} '${cmd.replace(/'/g, "'\\''")}'`;
  return execSync(sshCmd, { encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

let sshHost = '';
let sshPort = '';

// ─── Parse args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const specificOffer = getArg('--offer');
const existingInstance = getArg('--instance');
const dryRun = hasFlag('--dry-run');

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log('══════════════════════════════════════════════════');
  console.log('  Vast.ai GPU Setup — LTX Video 2.3 + ComfyUI');
  console.log('══════════════════════════════════════════════════\n');

  let instanceId = existingInstance;

  // ── Step 1: Find or create instance ──
  if (!instanceId) {
    console.log('🔍 Step 1: Finding cheapest GPU ≥ ' + MIN_VRAM_GB + 'GB VRAM...');
    
    // Use Vast.ai search query format — the unfiltered /bundles/ returns very few results
    const searchQuery = encodeURIComponent(JSON.stringify({
      gpu_ram: { gte: String(MIN_VRAM_GB * 1024) },
      rentable: { eq: true },
      order: [['dph_total', 'asc']],
      type: 'on-demand',
    }));
    const searchRes = await fetch(vastUrl(`/bundles/?q=${searchQuery}`), { headers: HEADERS });
    if (!searchRes.ok) throw new Error(`Search failed: HTTP ${searchRes.status}`);
    const { offers } = await searchRes.json();

    // Filter for disk space and price (search already filtered VRAM and rentable)
    let candidates = offers.filter(o =>
      o.disk_space >= MIN_DISK_GB &&
      o.dph_total <= MAX_PRICE_PER_HR
    );

    if (specificOffer) {
      candidates = candidates.filter(o => String(o.id) === specificOffer);
      if (!candidates.length) throw new Error(`Offer ${specificOffer} not found or doesn't meet requirements`);
    }

    // Prefer known-good GPUs, then sort by price
    candidates.sort((a, b) => {
      const aPreferred = PREFERRED_GPUS.some(g => a.gpu_name?.includes(g)) ? 0 : 1;
      const bPreferred = PREFERRED_GPUS.some(g => b.gpu_name?.includes(g)) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return a.dph_total - b.dph_total;
    });

    if (!candidates.length) throw new Error('No GPUs found matching requirements. Try raising MAX_PRICE_PER_HR.');

    const pick = candidates[0];
    console.log(`   Found: ${pick.gpu_name} (${(pick.gpu_ram / 1024).toFixed(0)}GB VRAM) — $${pick.dph_total.toFixed(3)}/hr`);
    console.log(`   Offer ID: ${pick.id} | Disk: ${pick.disk_space}GB | Upload: ${pick.inet_up?.toFixed(0) || '?'} Mbps`);

    if (dryRun) {
      console.log('\n   [DRY RUN] Would rent this instance. Exiting.');
      process.exit(0);
    }

    // Rent it
    console.log('   Renting...');
    const createRes = await fetch(vastUrl('/asks/' + pick.id + '/'), {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        client_id: 'me',
        image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
        disk: MIN_DISK_GB,
        onstart: ONSTART_SCRIPT,
        env: { '-p 8188:8188': '1' },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to rent: HTTP ${createRes.status} — ${err.substring(0, 200)}`);
    }

    const createData = await createRes.json();
    instanceId = String(createData.new_contract);
    console.log(`   ✅ Instance rented: ${instanceId} [${elapsed(t0)}]\n`);
  } else {
    console.log(`📌 Step 1: Using existing instance ${instanceId}\n`);
  }

  // ── Step 2: Wait for running + ports ──
  console.log('⏳ Step 2: Waiting for instance to boot...');
  const bootStart = Date.now();
  let inst;
  for (let i = 0; i < 60; i++) {
    await sleep(10000);
    const res = await fetch(vastUrl(`/instances/${instanceId}/`), { headers: HEADERS });
    if (!res.ok) continue;
    const body = await res.json();
    inst = body.instances || body;
    const status = inst.actual_status;
    const statusMsg = inst.status_msg || '';
    const hasPorts = !!inst.ports;
    process.stdout.write(`\r   [${i + 1}] ${status} | ports=${hasPorts}   `);
    if (status === 'running' && hasPorts) break;
    if (status === 'error' || statusMsg.includes('Error response')) {
      throw new Error(`Instance error: ${statusMsg.substring(0, 200)}`);
    }
  }
  if (inst?.actual_status !== 'running') throw new Error('Instance did not start within 10 min');
  
  // Extract connection info
  const ports = inst.ports || {};
  const comfyMapping = ports['8188/tcp']?.[0];
  const publicIp = inst.public_ipaddr;
  const comfyPort = comfyMapping?.HostPort;
  sshHost = inst.ssh_host || 'ssh4.vast.ai';
  sshPort = String(inst.ssh_port || '');

  console.log(`\n   ✅ Running at ${publicIp}:${comfyPort} | SSH: ${sshHost}:${sshPort} [${elapsed(bootStart)}]\n`);

  // ── Step 3: Register SSH key ──
  console.log('🔑 Step 3: Setting up SSH key...');
  const keyPath = join(homedir(), '.ssh', 'id_ed25519');
  const pubKeyPath = keyPath + '.pub';
  
  if (!existsSync(keyPath)) {
    console.log('   Generating new SSH key...');
    execSync(`ssh-keygen -t ed25519 -f ${keyPath} -N "" -q`, { stdio: 'pipe' });
  }
  
  const pubKey = readFileSync(pubKeyPath, 'utf8').trim();
  
  // Register with Vast.ai
  await fetch(vastUrl('/ssh/'), {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ ssh_key: pubKey }),
  }).catch(() => {}); // OK if already registered
  
  // Attach to instance
  await fetch(vastUrl(`/instances/${instanceId}/ssh/`), {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ ssh_key: pubKey }),
  });
  
  // Wait for SSH to become available
  let sshOk = false;
  for (let i = 0; i < 12; i++) {
    try {
      ssh('echo ok');
      sshOk = true;
      break;
    } catch { await sleep(5000); }
  }
  if (!sshOk) throw new Error('SSH not reachable after 60s');
  console.log('   ✅ SSH connected\n');

  // ── Step 4: Install ComfyUI (if not present) ──
  console.log('📦 Step 4: Checking ComfyUI installation...');
  const comfyCheck = ssh('test -f /workspace/ComfyUI/main.py && echo "exists" || echo "missing"');
  if (comfyCheck.includes('missing')) {
    console.log('   Installing ComfyUI via git...');
    ssh('cd /workspace && git clone https://github.com/comfyanonymous/ComfyUI.git 2>&1 | tail -5', { timeout: 120000 });
    ssh('cd /workspace/ComfyUI && pip install -r requirements.txt 2>&1 | tail -5', { timeout: 300000 });
    console.log('   ✅ ComfyUI installed');
  } else {
    console.log('   ✅ ComfyUI already installed');
  }
  // Ensure model directories exist
  ssh('mkdir -p /workspace/ComfyUI/models/{checkpoints,loras,text_encoders}');
  console.log('');

  // ── Step 5: Install custom nodes ──
  console.log('🔧 Step 5: Installing custom nodes...');
  
  // ComfyUI-LTXVideo
  try {
    const ltxCheck = ssh('test -d /workspace/ComfyUI/custom_nodes/ComfyUI-LTXVideo && echo "exists" || echo "missing"');
    if (ltxCheck.includes('missing')) {
      console.log('   Installing ComfyUI-LTXVideo...');
      ssh('cd /workspace/ComfyUI/custom_nodes && git clone https://github.com/Lightricks/ComfyUI-LTXVideo.git 2>&1 | tail -3', { timeout: 60000 });
    } else {
      console.log('   ✅ ComfyUI-LTXVideo already installed');
    }
  } catch (e) {
    console.log(`   ⚠️ LTXVideo install issue: ${e.message?.substring(0, 100)}`);
  }

  // Video concat extension
  console.log('   Installing video-concat extension...');
  ssh('mkdir -p /workspace/ComfyUI/custom_nodes/comfyui-video-concat');
  // Write via base64 to avoid shell escaping issues with Python code
  const b64Ext = Buffer.from(CONCAT_EXTENSION).toString('base64');
  ssh(`echo '${b64Ext}' | base64 -d > /workspace/ComfyUI/custom_nodes/comfyui-video-concat/__init__.py`);
  console.log('   ✅ Custom nodes installed\n');

  // ── Step 6: Download models ──
  console.log('📥 Step 6: Downloading models (~58GB total)...');
  console.log('   This takes 5-10 min depending on bandwidth.\n');

  // Check which models already exist (non-zero size)
  const existingFiles = ssh('cd /workspace/ComfyUI && for f in ' +
    Object.values(MODELS).map(m => m.dest).join(' ') +
    '; do [ -s "$f" ] && echo "$f:EXISTS" || echo "$f:MISSING"; done');

  const downloads = [];
  for (const [name, model] of Object.entries(MODELS)) {
    if (existingFiles.includes(`${model.dest}:EXISTS`)) {
      console.log(`   ✅ ${name}: already downloaded`);
    } else {
      console.log(`   ⬇️  ${name}: ${model.size} — downloading...`);
      downloads.push(model);
    }
  }

  if (downloads.length > 0) {
    // Build parallel wget commands
    const wgetCmds = downloads.map(m =>
      `wget -q -O /workspace/ComfyUI/${m.dest} "${m.url}"`
    ).join(' & ') + ' & wait';

    // Run downloads, write to log
    ssh(`cd /workspace/ComfyUI && echo "Starting downloads at $(date)" > /workspace/download.log && (${wgetCmds}) >> /workspace/download.log 2>&1 && echo "Done at $(date)" >> /workspace/download.log`, { timeout: 900000 }); // 15 min timeout

    // Verify downloads
    const verify = ssh('cd /workspace/ComfyUI && ls -lh ' + downloads.map(m => m.dest).join(' '));
    console.log('\n   Download results:');
    for (const line of verify.split('\n')) {
      if (line.trim()) console.log(`   ${line.trim()}`);
    }

    // Check for zero-byte files
    const zeroCheck = ssh('cd /workspace/ComfyUI && for f in ' + downloads.map(m => m.dest).join(' ') + '; do [ ! -s "$f" ] && echo "FAILED:$f"; done');
    if (zeroCheck.includes('FAILED')) {
      console.error('\n   ❌ Some downloads failed (0 bytes). Check URLs:');
      console.error('   ' + zeroCheck);
      throw new Error('Model download failed');
    }
  }
  console.log('   ✅ All models ready\n');

  // ── Step 7: Restart ComfyUI ──
  console.log('🔄 Step 7: Restarting ComfyUI with all extensions...');
  ssh('pkill -f "python.*main.py" 2>/dev/null; sleep 2; cd /workspace/ComfyUI && nohup python main.py --listen 0.0.0.0 --port 8188 > /workspace/comfyui.log 2>&1 &');
  
  // Wait for health
  const comfyBase = `http://${publicIp}:${comfyPort}`;
  let healthy = false;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    try {
      const hRes = await fetch(`${comfyBase}/system_stats`, { signal: AbortSignal.timeout(5000) });
      if (hRes.ok) { healthy = true; break; }
    } catch {}
    process.stdout.write('.');
  }
  if (!healthy) throw new Error('ComfyUI did not start within 2 min');
  
  // Verify concat endpoint
  let concatOk = false;
  try {
    const cRes = await fetch(`${comfyBase}/concat_videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [] }),
    });
    concatOk = cRes.status === 400; // Expected error for empty files
  } catch {}

  // Verify extensions loaded
  const logTail = ssh('tail -10 /workspace/comfyui.log');
  const ltxLoaded = logTail.includes('ComfyUI-LTXVideo');
  const concatLoaded = logTail.includes('comfyui-video-concat');

  console.log(`\n   ComfyUI: ✅ healthy at ${comfyBase}`);
  console.log(`   LTXVideo nodes: ${ltxLoaded ? '✅' : '❌'}`);
  console.log(`   Concat extension: ${concatLoaded && concatOk ? '✅' : '❌'}`);
  console.log('');

  // ── Step 8: Update env files ──
  console.log('📝 Step 8: Updating .env files...');
  for (const envFile of ['.env', '.env.local']) {
    if (!existsSync(envFile)) continue;
    let content = readFileSync(envFile, 'utf8');
    if (content.includes('VAST_INSTANCE_ID=')) {
      content = content.replace(/VAST_INSTANCE_ID=\S+/, `VAST_INSTANCE_ID=${instanceId}`);
    } else {
      content += `\nVAST_INSTANCE_ID=${instanceId}\n`;
    }
    writeFileSync(envFile, content);
    console.log(`   ✅ ${envFile} → VAST_INSTANCE_ID=${instanceId}`);
  }
  console.log('');

  // ── Done ──
  const totalTime = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log('══════════════════════════════════════════════════');
  console.log('  ✅ SETUP COMPLETE');
  console.log(`  Instance: ${instanceId}`);
  console.log(`  GPU: ${inst.gpu_name || 'unknown'} (${((inst.gpu_ram || 0) / 1024).toFixed(0)}GB VRAM)`);
  console.log(`  ComfyUI: ${comfyBase}`);
  console.log(`  SSH: ssh -i ~/.ssh/id_ed25519 -p ${sshPort} root@${sshHost}`);
  console.log(`  Cost: $${(inst.dph_total || 0).toFixed(3)}/hr ON, $${(inst.storage_cost || 0).toFixed(3)}/hr OFF`);
  console.log(`  Total setup time: ${totalTime} min`);
  console.log('══════════════════════════════════════════════════');
  console.log('\n  Next: node test-vast-video.mjs');
  console.log('  Stop:  curl -X PUT "' + vastUrl(`/instances/${instanceId}/`) + '" -H "Content-Type: application/json" -d \'{"state":"stopped"}\'');
}

main().catch(err => {
  console.error(`\n❌ Setup failed: ${err.message}`);
  process.exit(1);
});
