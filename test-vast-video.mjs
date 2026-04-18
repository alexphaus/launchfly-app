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

// LTX 2.3 model filenames (must be pre-downloaded on Vast.ai instance)
const LTX23_CHECKPOINT = 'ltx-2.3-22b-dev-fp8.safetensors';
const LTX23_DISTILLED_LORA = 'ltx-2.3-22b-distilled-lora-384-1.1.safetensors';
const LTX23_TEXT_ENCODER = 'comfy_gemma_3_12B_it.safetensors';
const LTX23_DISTILLED_SIGMAS = '1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0';

// Test params
const prompt = 'A professional plumber fixing a kitchen sink, clean bright workshop, smooth camera pan, cinematic lighting. The sound of running water and metal tools clinking.';
const negativePrompt = 'blurry, distorted, low quality, watermark, cartoon';
const duration = 5;
const width = 768;
const height = 512;
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
  console.log('  Vast.ai + LTX Video 2.3 — Start/Generate/Stop Test');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`  Instance ID: ${persistentInstanceId}`);
  console.log(`  Prompt: "${prompt}"`);
  console.log(`  Duration: ${duration}s (${numFrames} frames @ 24fps)`);
  console.log(`  Resolution: ${width}x${height}, Model: LTX 2.3 distilled (8 steps)\n`);

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

  // ── Step 4: Submit LTX 2.3 workflow ──
  console.log(`\n🎬 Step 4: Submitting LTX Video 2.3 workflow... [${elapsed(t0)}s]`);
  const clientId = crypto.randomUUID();

  const workflow = {
    // Load model checkpoint (FP8 for VRAM efficiency)
    "1":  { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": LTX23_CHECKPOINT } },
    // Apply distilled LoRA (enables 8-step generation)
    "2":  { "class_type": "LoraLoaderModelOnly", "inputs": { "model": ["1", 0], "lora_name": LTX23_DISTILLED_LORA, "strength_model": 0.5 } },
    // Load Gemma 3 text encoder
    "3":  { "class_type": "LTXAVTextEncoderLoader", "inputs": { "text_encoder": LTX23_TEXT_ENCODER, "ckpt_name": LTX23_CHECKPOINT, "device": "default" } },
    // Encode positive prompt
    "4":  { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["3", 0] } },
    // Encode negative prompt
    "5":  { "class_type": "CLIPTextEncode", "inputs": { "text": negativePrompt, "clip": ["3", 0] } },
    // Empty video latent
    "6":  { "class_type": "EmptyLTXVLatentVideo", "inputs": { "width": width, "height": height, "length": numFrames, "batch_size": 1 } },
    // Audio VAE loader
    "7":  { "class_type": "LTXVAudioVAELoader", "inputs": { "ckpt_name": LTX23_CHECKPOINT } },
    // Empty audio latent
    "8":  { "class_type": "LTXVEmptyLatentAudio", "inputs": { "frames_number": numFrames, "frame_rate": 24, "batch_size": 1, "audio_vae": ["7", 0] } },
    // Concat video + audio latents
    "9":  { "class_type": "LTXVConcatAVLatent", "inputs": { "video_latent": ["6", 0], "audio_latent": ["8", 0] } },
    // Conditioning
    "10": { "class_type": "LTXVConditioning", "inputs": { "positive": ["4", 0], "negative": ["5", 0], "frame_rate": 24 } },
    // CFG guider (cfg=1 for distilled)
    "11": { "class_type": "CFGGuider", "inputs": { "model": ["2", 0], "positive": ["10", 0], "negative": ["10", 1], "cfg": 1 } },
    // Random noise
    "12": { "class_type": "RandomNoise", "inputs": { "noise_seed": Math.floor(Math.random() * 2**32) } },
    // Sampler selection
    "13": { "class_type": "KSamplerSelect", "inputs": { "sampler_name": "euler_ancestral_cfg_pp" } },
    // Manual sigma schedule (8 steps, optimized for distilled)
    "14": { "class_type": "ManualSigmas", "inputs": { "sigmas": LTX23_DISTILLED_SIGMAS } },
    // Advanced sampler
    "15": { "class_type": "SamplerCustomAdvanced", "inputs": { "noise": ["12", 0], "guider": ["11", 0], "sampler": ["13", 0], "sigmas": ["14", 0], "latent_image": ["9", 0] } },
    // Separate audio/video latents
    "16": { "class_type": "LTXVSeparateAVLatent", "inputs": { "av_latent": ["15", 0] } },
    // Decode video (tiled for memory efficiency)
    "17": { "class_type": "LTXVTiledVAEDecode", "inputs": { "vae": ["1", 2], "latents": ["16", 0], "horizontal_tiles": 2, "vertical_tiles": 2, "overlap": 6, "last_frame_fix": false } },
    // Decode audio
    "18": { "class_type": "LTXVAudioVAEDecode", "inputs": { "samples": ["16", 1], "audio_vae": ["7", 0] } },
    // Create video (combine video frames + audio)
    "19": { "class_type": "CreateVideo", "inputs": { "images": ["17", 0], "audio": ["18", 0], "fps": 24 } },
    // Save video
    "20": { "class_type": "SaveVideo", "inputs": { "video": ["19", 0], "filename_prefix": "ltx_output", "format": "auto", "codec": "auto" } },
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
        const files = nodeOutput.videos || nodeOutput.images;
        if (files?.length) {
          const file = files[0];
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
    const filename = `${BUSINESS_ID}/ltx-test-${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from('generated-media')
      .upload(filename, mediaBuffer, { contentType: 'video/mp4' });

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
