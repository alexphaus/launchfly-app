import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apiKey = process.env.VASTAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const persistentInstanceId = process.env.VAST_INSTANCE_ID;

if (!apiKey) { console.error('Missing VASTAI_API_KEY'); process.exit(1); }
if (!persistentInstanceId) { console.error('Missing VAST_INSTANCE_ID in .env — rent an instance on vast.ai and add it'); process.exit(1); }

const COMFYUI_PORT = 8188;
const POLL_INTERVAL = 10_000;
const BOOT_TIMEOUT = 300_000;   // 5 min for stopped→running boot
const COMFYUI_TIMEOUT = 600_000; // 10 min for ComfyUI health
const GEN_TIMEOUT = 600_000;    // 10 min for video generation
const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const vastBase = 'https://console.vast.ai/api/v0';
const authParam = `api_key=${encodeURIComponent(apiKey)}`;
const vastUrl = (path) => {
  const sep = path.includes('?') ? '&' : '?';
  return `${vastBase}${path}${sep}${authParam}`;
};
const vastHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

// Test params
const prompt = 'A professional plumber fixing a kitchen sink, clean bright workshop, smooth camera pan, cinematic lighting';
const negativePrompt = 'blurry, distorted, low quality, watermark';
const duration = 5;
const width = 768;
const height = 512;
const steps = 20;
const cfgScale = 7;
const numFrames = Math.round(duration * 24 / 8) * 8 + 1; // LTX requires length = 8n+1

function elapsed(start) { return ((Date.now() - start) / 1000).toFixed(1); }

async function getInstanceInfo() {
  const res = await fetch(vastUrl(`/instances/${persistentInstanceId}/`), { headers: vastHeaders });
  if (!res.ok) throw new Error(`Failed to get instance: HTTP ${res.status}`);
  const body = await res.json();
  return body.instances || body;
}

async function setInstanceState(state) {
  const res = await fetch(vastUrl(`/instances/${persistentInstanceId}/`), {
    method: 'PUT',
    headers: vastHeaders,
    body: JSON.stringify({ state }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to set state to ${state}: HTTP ${res.status} — ${err}`);
  }
  return res.json();
}

async function stopInstance() {
  console.log(`\n⏹️  Stopping instance ${persistentInstanceId} (preserving disk)...`);
  try {
    await setInstanceState('stopped');
    console.log('   ✅ Instance stopped — disk preserved, no GPU charges');
  } catch (e) {
    console.error('   ❌ Failed to stop:', e.message);
  }
}

// Cleanup on ctrl+c — stop instead of destroy
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted! Stopping instance...');
  await stopInstance();
  process.exit(1);
});

function extractIpPort(inst) {
  const ports = inst.ports || {};
  const comfyPort = ports[`${COMFYUI_PORT}/tcp`]?.[0];
  if (!comfyPort) return null;
  const pip = inst.public_ipaddr;
  const isPublic = pip && !pip.startsWith('192.168.') && !pip.startsWith('10.') && !pip.startsWith('172.') && pip !== '127.0.0.1';
  return {
    ip: isPublic ? pip : comfyPort.HostIp,
    port: parseInt(comfyPort.HostPort),
  };
}

async function main() {
  const t0 = Date.now();
  console.log('══════════════════════════════════════════════════');
  console.log('  Vast.ai + LTX Video — Start/Generate/Stop Test');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`  Instance ID: ${persistentInstanceId}`);
  console.log(`  Prompt: "${prompt}"`);
  console.log(`  Duration: ${duration}s (${numFrames} frames @ 24fps)`);
  console.log(`  Resolution: ${width}x${height}, Steps: ${steps}, CFG: ${cfgScale}\n`);

  // ── Step 1: Check balance ──
  console.log('📊 Step 1: Checking balance...');
  const userRes = await fetch(vastUrl('/users/current/'), { headers: { Accept: 'application/json' } });
  const user = await userRes.json();
  console.log(`   Balance: $${(user.credit || 0).toFixed(2)}`);
  if ((user.credit || 0) < 0.25) {
    console.error('   ❌ Balance too low');
    process.exit(1);
  }

  // ── Step 2: Check instance state & start if needed ──
  console.log(`\n🔍 Step 2: Checking instance state... [${elapsed(t0)}s]`);
  let inst = await getInstanceInfo();
  console.log(`   Status: ${inst.actual_status} | State: ${inst.cur_state}`);

  let conn = null;

  if (inst.actual_status === 'running') {
    conn = extractIpPort(inst);
    if (conn) console.log(`   ✅ Already running at ${conn.ip}:${conn.port}`);

  } else if (inst.actual_status === 'stopped' || inst.actual_status === 'exited') {
    console.log(`   🚀 Starting instance...`);
    await setInstanceState('running');

    const bootStart = Date.now();
    while (Date.now() - bootStart < BOOT_TIMEOUT) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      inst = await getInstanceInfo();
      process.stdout.write(` [${inst.actual_status}]`);

      if (inst.actual_status === 'running') {
        conn = extractIpPort(inst);
        if (conn) {
          console.log(`\n   ✅ Instance booted at ${conn.ip}:${conn.port} [${elapsed(t0)}s]`);
          break;
        }
      }
      if (inst.actual_status === 'error') {
        console.error(`\n   ❌ Instance error: ${inst.status_msg}`);
        process.exit(1);
      }
    }

  } else if (inst.actual_status === 'loading') {
    console.log(`   ⏳ Instance is still loading (Docker pull in progress)...`);
    const loadStart = Date.now();
    while (Date.now() - loadStart < BOOT_TIMEOUT) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      inst = await getInstanceInfo();
      process.stdout.write(` [${inst.actual_status}]`);

      if (inst.actual_status === 'running') {
        conn = extractIpPort(inst);
        if (conn) {
          console.log(`\n   ✅ Instance ready at ${conn.ip}:${conn.port} [${elapsed(t0)}s]`);
          break;
        }
      }
      if (inst.actual_status === 'error' || inst.actual_status === 'exited') {
        console.error(`\n   ❌ Instance failed: ${inst.actual_status}`);
        process.exit(1);
      }
    }
  } else {
    console.error(`   ❌ Unexpected instance state: ${inst.actual_status}`);
    process.exit(1);
  }

  if (!conn) {
    console.error(`\n   ❌ Could not get IP/port within timeout`);
    process.exit(1);
  }

  // ── Step 3: Wait for ComfyUI health ──
  const comfyBase = `http://${conn.ip}:${conn.port}`;
  console.log(`\n🏥 Step 3: Waiting for ComfyUI at ${comfyBase}... [${elapsed(t0)}s]`);
  console.log('   (Model loading may take 1-2 min on warm boot, longer on first boot)');

  const healthStart = Date.now();
  let comfyReady = false;
  while (Date.now() - healthStart < COMFYUI_TIMEOUT) {
    try {
      const hRes = await fetch(`${comfyBase}/system_stats`, { signal: AbortSignal.timeout(5000) });
      if (hRes.ok) {
        const stats = await hRes.json();
        console.log(`\n   ✅ ComfyUI ready! VRAM: ${(stats.system?.vram_total / 1e9 || 0).toFixed(1)}GB [${elapsed(t0)}s]`);
        comfyReady = true;
        break;
      }
    } catch { /* not ready */ }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 10000));
  }

  if (!comfyReady) {
    console.error(`\n   ❌ ComfyUI not responding after ${COMFYUI_TIMEOUT/1000}s`);
    await stopInstance();
    process.exit(1);
  }

  // ── Step 4: Submit LTX workflow ──
  console.log(`\n🎬 Step 4: Submitting LTX Video workflow... [${elapsed(t0)}s]`);
  const clientId = crypto.randomUUID();

  const workflow = {
    "1": { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["11", 0] } },
    "2": { "class_type": "CLIPTextEncode", "inputs": { "text": negativePrompt, "clip": ["11", 0] } },
    "3": { "class_type": "LTXVConditioning", "inputs": { "positive": ["1", 0], "negative": ["2", 0], "frame_rate": 24.0 } },
    "4": { "class_type": "LTXVScheduler", "inputs": { "steps": steps, "max_shift": 2.05, "base_shift": 0.95, "stretch": true, "terminal": 0.1, "latent": ["5", 0] } },
    "5": { "class_type": "EmptyLTXVLatentVideo", "inputs": { "width": width, "height": height, "length": numFrames, "batch_size": 1 } },
    "6": { "class_type": "SamplerCustom", "inputs": { "model": ["8", 0], "add_noise": true, "noise_seed": Math.floor(Math.random() * 2**32), "cfg": cfgScale, "positive": ["3", 0], "negative": ["3", 1], "sampler": ["7", 0], "sigmas": ["4", 0], "latent_image": ["5", 0] } },
    "7": { "class_type": "KSamplerSelect", "inputs": { "sampler_name": "euler" } },
    "8": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "ltxv-2b-0.9.8-distilled.safetensors" } },
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["6", 0], "vae": ["8", 2] } },
    "10": { "class_type": "SaveAnimatedWEBP", "inputs": { "images": ["9", 0], "filename_prefix": "ltx_output", "fps": 24.0, "lossless": false, "quality": 90, "method": "default" } },
    "11": { "class_type": "CLIPLoader", "inputs": { "clip_name": "t5xxl_fp16.safetensors", "type": "ltxv" } }
  };

  const queueRes = await fetch(`${comfyBase}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    console.error(`   ❌ ComfyUI rejected workflow: HTTP ${queueRes.status}`);
    console.error(`   ${errText.substring(0, 500)}`);
    await stopInstance();
    process.exit(1);
  }

  const queueData = await queueRes.json();
  const promptId = queueData.prompt_id;
  console.log(`   ✅ Queued! Prompt ID: ${promptId}`);

  // ── Step 5: Poll for completion ──
  console.log(`\n⏳ Step 5: Waiting for video generation... [${elapsed(t0)}s]`);
  const pollStart = Date.now();
  let outputUrl = null;

  while (Date.now() - pollStart < GEN_TIMEOUT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    try {
      const histRes = await fetch(`${comfyBase}/history/${promptId}`, { signal: AbortSignal.timeout(10000) });
      if (!histRes.ok) { process.stdout.write('.'); continue; }
      const history = await histRes.json();
      const entry = history[promptId];
      if (!entry?.outputs) { process.stdout.write('⏳'); continue; }

      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images?.length) {
          const file = nodeOutput.images[0];
          outputUrl = `${comfyBase}/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder || '')}&type=${file.type || 'output'}`;
          break;
        }
      }
      if (outputUrl) break;
    } catch { process.stdout.write('!'); }
  }

  if (!outputUrl) {
    console.error(`\n   ❌ Generation timed out after ${GEN_TIMEOUT/1000}s`);
    await stopInstance();
    process.exit(1);
  }

  console.log(`\n   ✅ Video ready! [${elapsed(t0)}s]`);

  // ── Step 6: Download + upload to Supabase ──
  console.log(`\n📥 Step 6: Downloading and uploading to Supabase... [${elapsed(t0)}s]`);
  const mediaRes = await fetch(outputUrl);
  if (!mediaRes.ok) {
    console.error(`   ❌ Download failed: HTTP ${mediaRes.status}`);
    await stopInstance();
    process.exit(1);
  }
  const mediaBuffer = await mediaRes.arrayBuffer();
  console.log(`   Downloaded: ${(mediaBuffer.byteLength / 1024).toFixed(0)} KB`);

  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase.storage.createBucket('generated-media', { public: true }).catch(() => {});
    const filename = `${BUSINESS_ID}/ltx-test-${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from('generated-media')
      .upload(filename, mediaBuffer, { contentType: 'image/webp' });

    if (uploadError) {
      console.error(`   ❌ Upload failed: ${uploadError.message}`);
    } else {
      const { data } = supabase.storage.from('generated-media').getPublicUrl(filename);
      console.log(`   ✅ Uploaded! URL: ${data.publicUrl}`);
    }
  } else {
    console.log('   ⚠️  No Supabase keys — skipping upload');
  }

  // ── Step 7: Stop instance (preserve disk, stop GPU charges) ──
  await stopInstance();

  // ── Final balance ──
  const finalUser = await fetch(vastUrl('/users/current/'), { headers: { Accept: 'application/json' } }).then(r => r.json());
  const cost = (user.credit || 0) - (finalUser.credit || 0);

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ TEST COMPLETE');
  console.log(`  Total time: ${elapsed(t0)}s`);
  console.log(`  Cost: ~$${cost.toFixed(4)}`);
  console.log(`  Starting balance: $${(user.credit||0).toFixed(2)} → Final: $${(finalUser.credit||0).toFixed(2)}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(async (err) => {
  console.error('\n💥 Unexpected error:', err);
  await stopInstance();
  process.exit(1);
});
