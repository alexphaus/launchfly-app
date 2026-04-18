import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apiKey = process.env.VASTAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!apiKey) { console.error('Missing VASTAI_API_KEY'); process.exit(1); }

const COMFYUI_PORT = 8188;
const POLL_INTERVAL = 10_000;
const MAX_WAIT = 600_000; // 10 min
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
const numFrames = Math.round(duration * 24);

let instanceId = null;

function elapsed(start) { return ((Date.now() - start) / 1000).toFixed(1); }

async function destroyInstance() {
  if (!instanceId) return;
  console.log(`\n🗑️  Destroying instance ${instanceId}...`);
  try {
    await fetch(vastUrl(`/instances/${instanceId}/`), { method: 'DELETE', headers: vastHeaders });
    console.log('   ✅ Instance destroyed');
  } catch (e) {
    console.error('   ❌ Failed to destroy:', e.message);
  }
}

// Cleanup on ctrl+c
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted! Cleaning up...');
  await destroyInstance();
  process.exit(1);
});

async function main() {
  const t0 = Date.now();
  console.log('══════════════════════════════════════════════════');
  console.log('  Vast.ai + LTX Video 2.3 — End-to-End Test');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`  Prompt: "${prompt}"`);
  console.log(`  Duration: ${duration}s (${numFrames} frames @ 24fps)`);
  console.log(`  Resolution: ${width}x${height}, Steps: ${steps}, CFG: ${cfgScale}\n`);

  // ── Step 1: Check balance ──
  console.log('📊 Step 1: Checking balance...');
  const userRes = await fetch(vastUrl('/users/current/'), { headers: { Accept: 'application/json' } });
  const user = await userRes.json();
  console.log(`   Balance: $${(user.credit || 0).toFixed(2)}`);
  if ((user.credit || 0) < 0.50) {
    console.error('   ❌ Balance too low (need ~$0.50 minimum). Add credit at cloud.vast.ai/billing');
    process.exit(1);
  }

  // ── Step 2: Check for existing instance ──
  console.log(`\n🔍 Step 2: Checking for existing instances... [${elapsed(t0)}s]`);
  const listRes = await fetch(vastUrl('/instances/?owner=me'), { headers: vastHeaders });
  const listBody = await listRes.json();
  const instances = listBody.instances || [];
  const label = `launchfly-comfyui-${BUSINESS_ID.substring(0, 8)}`;
  
  let instanceIp = null;
  let instancePort = null;
  
  const existing = instances.find(i => i.label === label && i.actual_status === 'running');
  if (existing) {
    instanceId = existing.id;
    const ports = existing.ports || {};
    const comfyPort = ports[`${COMFYUI_PORT}/tcp`]?.[0];
    if (comfyPort) {
      instanceIp = existing.public_ipaddr || comfyPort.HostIp;
      instancePort = parseInt(comfyPort.HostPort);
    }
    console.log(`   ♻️  Found existing instance ${instanceId} at ${instanceIp}:${instancePort}`);
  } else {
    console.log(`   No existing instance. Will create one.`);

    // ── Step 3: Find cheapest RTX 4090 ──
    console.log(`\n🔎 Step 3: Searching for RTX 4090 offers... [${elapsed(t0)}s]`);
    const searchQ = encodeURIComponent(JSON.stringify({
      gpu_name: { eq: 'RTX 4090' }, num_gpus: { eq: 1 }, disk_space: { gte: 40 },
      reliability2: { gte: 0.9 }, inet_down: { gte: 100 },
      order: [['dph_total', 'asc']], type: 'on-demand', limit: 10,
    }));
    const searchRes = await fetch(vastUrl(`/bundles/?q=${searchQ}`), { headers: vastHeaders });
    if (!searchRes.ok) {
      console.error(`   ❌ Search failed: HTTP ${searchRes.status}`);
      console.error(await searchRes.text());
      process.exit(1);
    }
    const offers = (await searchRes.json()).offers || [];
    if (!offers.length) {
      console.error('   ❌ No RTX 4090 offers available right now');
      process.exit(1);
    }

    console.log(`   ✅ Found ${offers.length} offers. Cheapest: $${offers[0].dph_total?.toFixed(4)}/hr`);

    // ── Step 4: Create instance (try multiple offers) ──
    console.log(`\n🚀 Step 4: Creating instance... [${elapsed(t0)}s]`);
    let created = null;
    for (let i = 0; i < Math.min(offers.length, 5); i++) {
      const offer = offers[i];
      console.log(`   Trying offer #${i+1}: ID ${offer.id}, $${offer.dph_total?.toFixed(4)}/hr...`);
      const createRes = await fetch(vastUrl(`/asks/${offer.id}/`), {
        method: 'PUT',
        headers: vastHeaders,
        body: JSON.stringify({
          client_id: 'me',
          image: 'yanwk/comfyui-boot:cu126-megapak',
          disk: 40,
          label,
          onstart: 'bash -c "mkdir -p /root/ComfyUI/models/checkpoints && cd /root/ComfyUI/models/checkpoints && if [ ! -f ltx-video-2-1-0.2-dev.safetensors ]; then wget -q https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltx-video-2-1-0.2-dev.safetensors; fi && cd /root/ComfyUI && python main.py --listen 0.0.0.0 --port 8188"',
          env: { '-p': `${COMFYUI_PORT}:${COMFYUI_PORT}` },
        }),
      });

      if (createRes.ok) {
        created = await createRes.json();
        console.log(`   ✅ Instance created: ID ${created.new_contract}`);
        break;
      } else {
        const errBody = await createRes.text();
        console.log(`   ⚠️  Offer ${offer.id} failed: ${errBody.substring(0, 100)}`);
      }
    }

    if (!created) {
      console.error('   ❌ All offers failed. Try again in a minute.');
      process.exit(1);
    }
    instanceId = created.new_contract;

    // ── Step 5: Wait for instance to be running ──
    console.log(`\n⏳ Step 5: Waiting for instance to start... [${elapsed(t0)}s]`);
    const startTime = Date.now();
    while (Date.now() - startTime < MAX_WAIT) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      try {
        const statusRes = await fetch(vastUrl(`/instances/${instanceId}/`), { headers: vastHeaders });
        if (!statusRes.ok) { process.stdout.write('.'); continue; }
        const instBody = await statusRes.json();
        const inst = instBody.instances || instBody;
        process.stdout.write(` [${inst.actual_status || inst.status_msg || '?'}]`);
        
        if (inst.actual_status === 'running') {
          const ports = inst.ports || {};
          const comfyPort = ports[`${COMFYUI_PORT}/tcp`]?.[0];
          if (comfyPort) {
            instanceIp = inst.public_ipaddr || comfyPort.HostIp;
            instancePort = parseInt(comfyPort.HostPort);
            console.log(`\n   ✅ Instance running at ${instanceIp}:${instancePort} [${elapsed(t0)}s]`);
            break;
          }
        }
        if (inst.actual_status === 'exited' || inst.actual_status === 'error') {
          console.error(`\n   ❌ Instance failed: ${inst.actual_status}`);
          await destroyInstance();
          process.exit(1);
        }
      } catch (e) { process.stdout.write('!'); }
    }

    if (!instanceIp || !instancePort) {
      console.error(`\n   ❌ Instance didn't start within ${MAX_WAIT/1000}s`);
      await destroyInstance();
      process.exit(1);
    }
  }

  // ── Step 6: Wait for ComfyUI health ──
  const comfyBase = `http://${instanceIp}:${instancePort}`;
  console.log(`\n🏥 Step 6: Waiting for ComfyUI to be healthy at ${comfyBase}... [${elapsed(t0)}s]`);
  console.log('   (This may take a few minutes — downloading 9.5GB LTX model on first boot)');
  
  const healthStart = Date.now();
  let comfyReady = false;
  while (Date.now() - healthStart < 600_000) { // 10 min for model download
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
    console.error(`\n   ❌ ComfyUI not responding after 10 minutes`);
    await destroyInstance();
    process.exit(1);
  }

  // ── Step 7: Submit LTX workflow ──
  console.log(`\n🎬 Step 7: Submitting LTX Video workflow... [${elapsed(t0)}s]`);
  const clientId = crypto.randomUUID();

  const workflow = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'ltx-video-2-1-0.2-dev.safetensors' },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['1', 1] },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['1', 1] },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: numFrames },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed: Math.floor(Math.random() * 2147483647),
        steps,
        cfg: cfgScale,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
    },
    '8': {
      class_type: 'SaveAnimatedWEBP',
      inputs: { images: ['6', 0], filename_prefix: 'ltx_output', fps: 24, quality: 90, method: 'default' },
    },
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
    await destroyInstance();
    process.exit(1);
  }

  const queueData = await queueRes.json();
  const promptId = queueData.prompt_id;
  console.log(`   ✅ Queued! Prompt ID: ${promptId}`);

  // ── Step 8: Poll for completion ──
  console.log(`\n⏳ Step 8: Waiting for video generation... [${elapsed(t0)}s]`);
  const pollStart = Date.now();
  let outputUrl = null;

  while (Date.now() - pollStart < MAX_WAIT) {
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
    console.error(`\n   ❌ Generation timed out after ${MAX_WAIT/1000}s`);
    await destroyInstance();
    process.exit(1);
  }

  console.log(`\n   ✅ Video ready! [${elapsed(t0)}s]`);

  // ── Step 9: Download + upload to Supabase ──
  console.log(`\n📥 Step 9: Downloading and uploading to Supabase... [${elapsed(t0)}s]`);
  const mediaRes = await fetch(outputUrl);
  if (!mediaRes.ok) {
    console.error(`   ❌ Download failed: HTTP ${mediaRes.status}`);
    await destroyInstance();
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
      console.log(`   ✅ Uploaded! Permanent URL: ${data.publicUrl}`);
    }
  } else {
    console.log('   ⚠️  No Supabase keys — skipping upload');
  }

  // ── Step 10: Destroy instance ──
  await destroyInstance();

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
  await destroyInstance();
  process.exit(1);
});
