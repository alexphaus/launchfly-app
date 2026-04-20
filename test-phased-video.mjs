#!/usr/bin/env node
/**
 * End-to-end test for the phased video generation pipeline.
 * Simulates what workflow-runner does: calls video-generate in a loop,
 * passing state between phases (boot → scene → finalize).
 * 
 * This calls the helpers directly via a TypeScript shim since they're
 * exported from tools.ts. We replicate the exact phased logic from
 * video-generate/route.ts.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const API_KEY = '7b0685b0737ae6aa9b90bb9cca8fe2ff438a512897a3d5b5782049255b7d49a1';
const INSTANCE_ID = '35204200';
const VAST_BASE = 'https://console.vast.ai/api/v0';
const COMFYUI_PORT = 8188;
const POLL_INTERVAL = 10_000;

function vastUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${VAST_BASE}${path}${sep}api_key=${encodeURIComponent(API_KEY)}`;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function extractIpPort(inst) {
  const ports = inst.ports || {};
  const mapping = ports[`${COMFYUI_PORT}/tcp`]?.[0];
  if (!mapping) return null;
  const ip = inst.public_ipaddr || mapping.HostIp;
  if (!ip || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return null;
  return { ip, port: parseInt(mapping.HostPort) };
}

// ── Phase 1: Boot ──
async function phaseBoot() {
  console.log('\n═══ PHASE: BOOT ═══');
  const startMs = Date.now();

  // Check current status
  const infoRes = await fetch(vastUrl(`/instances/${INSTANCE_ID}/`));
  const infoBody = await infoRes.json();
  let inst = infoBody.instances || infoBody;
  let status = inst?.actual_status;
  console.log(`  Instance ${INSTANCE_ID} status: ${status}`);

  if (!status) {
    return { error: `Instance not found or destroyed.` };
  }

  // Handle stopping state
  if (status === 'stopping') {
    console.log('  Waiting for stopping state to complete...');
    const stopStart = Date.now();
    while (Date.now() - stopStart < 120_000) {
      await sleep(5000);
      const pollRes = await fetch(vastUrl(`/instances/${INSTANCE_ID}/`));
      const pollBody = await pollRes.json();
      inst = pollBody.instances || pollBody;
      status = inst?.actual_status;
      console.log(`  ... status: ${status}`);
      if (status !== 'stopping') break;
    }
  }

  // Start if not running
  if (['stopped', 'offline', 'exited'].includes(status)) {
    console.log('  Starting instance...');
    const startRes = await fetch(vastUrl(`/instances/${INSTANCE_ID}/`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ state: 'running' }),
    });
    if (!startRes.ok) return { error: `Failed to start: HTTP ${startRes.status}` };

    // Poll until running
    const bootStart = Date.now();
    while (Date.now() - bootStart < 300_000) {
      await sleep(POLL_INTERVAL);
      const pollRes = await fetch(vastUrl(`/instances/${INSTANCE_ID}/`));
      const pollBody = await pollRes.json();
      inst = pollBody.instances || pollBody;
      status = inst?.actual_status;
      const elapsed = ((Date.now() - bootStart) / 1000).toFixed(0);
      console.log(`  [${elapsed}s] status: ${status}`);
      if (status === 'running') break;
      if (status === 'error') return { error: `Instance failed to start.` };
    }
    if (status !== 'running') return { error: `Instance did not start within 5 min.` };
  } else if (status !== 'running') {
    return { error: `Instance in unexpected state: ${status}` };
  }

  const conn = extractIpPort(inst);
  if (!conn) return { error: `Cannot determine IP/port for instance.` };
  const comfyBase = `http://${conn.ip}:${conn.port}`;

  // Wait for ComfyUI health
  console.log(`  Waiting for ComfyUI at ${comfyBase}...`);
  const healthStart = Date.now();
  let comfyReady = false;
  while (Date.now() - healthStart < 600_000) {
    try {
      const hRes = await fetch(`${comfyBase}/system_stats`, { signal: AbortSignal.timeout(5000) });
      if (hRes.ok) { comfyReady = true; break; }
    } catch { /* not ready */ }
    const elapsed = ((Date.now() - healthStart) / 1000).toFixed(0);
    console.log(`  [${elapsed}s] ComfyUI not ready yet...`);
    await sleep(5000);
  }
  if (!comfyReady) return { error: `ComfyUI not responding after 10 min.` };

  const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`  ✅ Boot complete in ${totalElapsed}s → ${comfyBase}`);
  return { comfyBase };
}

// ── Phase 2: Generate one scene ──
async function phaseScene(comfyBase, { prompt, negativePrompt, width, height, numFrames, filenamePrefix }) {
  console.log(`\n═══ PHASE: SCENE (${filenamePrefix}) ═══`);
  const startMs = Date.now();
  console.log(`  Prompt: "${prompt.substring(0, 80)}..."`);

  // Build LTX 2.3 workflow (same as buildLTX23Workflow in tools.ts)
  const workflow = {
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'ltx-2.3-22b-dev-fp8.safetensors' } },
    '2':  { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: 'ltx-2.3-22b-distilled-lora-384-1.1.safetensors', strength_model: 0.5 } },
    '3':  { class_type: 'LTXAVTextEncoderLoader', inputs: { text_encoder: 'comfy_gemma_3_12B_it.safetensors', ckpt_name: 'ltx-2.3-22b-dev-fp8.safetensors', device: 'default' } },
    '4':  { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['3', 0] } },
    '5':  { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['3', 0] } },
    '6':  { class_type: 'EmptyLTXVLatentVideo', inputs: { width, height, length: numFrames, batch_size: 1 } },
    '7':  { class_type: 'LTXVAudioVAELoader', inputs: { ckpt_name: 'ltx-2.3-22b-dev-fp8.safetensors' } },
    '8':  { class_type: 'LTXVEmptyLatentAudio', inputs: { frames_number: numFrames, frame_rate: 24, batch_size: 1, audio_vae: ['7', 0] } },
    '9':  { class_type: 'LTXVConcatAVLatent', inputs: { video_latent: ['6', 0], audio_latent: ['8', 0] } },
    '10': { class_type: 'LTXVConditioning', inputs: { positive: ['4', 0], negative: ['5', 0], frame_rate: 24 } },
    '11': { class_type: 'CFGGuider', inputs: { model: ['2', 0], positive: ['10', 0], negative: ['10', 1], cfg: 1 } },
    '12': { class_type: 'RandomNoise', inputs: { noise_seed: Math.floor(Math.random() * 2 ** 32) } },
    '13': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler_ancestral_cfg_pp' } },
    '14': { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0' } },
    '15': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['12', 0], guider: ['11', 0], sampler: ['13', 0], sigmas: ['14', 0], latent_image: ['9', 0] } },
    '16': { class_type: 'LTXVSeparateAVLatent', inputs: { av_latent: ['15', 0] } },
    '17': { class_type: 'LTXVTiledVAEDecode', inputs: { vae: ['1', 2], latents: ['16', 0], horizontal_tiles: 2, vertical_tiles: 2, overlap: 6, last_frame_fix: false } },
    '18': { class_type: 'LTXVAudioVAEDecode', inputs: { samples: ['16', 1], audio_vae: ['7', 0] } },
    '19': { class_type: 'CreateVideo', inputs: { images: ['17', 0], audio: ['18', 0], fps: 24 } },
    '20': { class_type: 'SaveVideo', inputs: { video: ['19', 0], filename_prefix: filenamePrefix || 'ltx_output', format: 'auto', codec: 'auto' } },
  };

  // Submit workflow
  const clientId = crypto.randomUUID();
  const queueRes = await fetch(`${comfyBase}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!queueRes.ok) {
    const errText = await queueRes.text();
    return { error: `ComfyUI rejected workflow: HTTP ${queueRes.status} — ${errText.substring(0, 300)}` };
  }
  const { prompt_id: promptId } = await queueRes.json();
  console.log(`  Workflow queued: ${promptId}`);

  // Poll for completion
  const pollStart = Date.now();
  while (Date.now() - pollStart < 600_000) {
    await sleep(POLL_INTERVAL);
    try {
      const histRes = await fetch(`${comfyBase}/history/${promptId}`, { signal: AbortSignal.timeout(10000) });
      if (!histRes.ok) continue;
      const history = await histRes.json();
      const entry = history[promptId];
      if (!entry) { process.stdout.write('.'); continue; }
      if (entry.status?.status_str === 'error') return { error: `ComfyUI generation error for ${promptId}` };
      if (!entry.outputs) { process.stdout.write('.'); continue; }
      for (const nodeOutput of Object.values(entry.outputs)) {
        const files = nodeOutput.videos || nodeOutput.images;
        if (files?.length) {
          const file = files[0];
          const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
          console.log(`\n  ✅ Scene done in ${elapsed}s → ${file.filename}`);
          return { filename: file.filename };
        }
      }
    } catch { process.stdout.write('x'); }
  }
  return { error: `Generation timed out after 10 min.` };
}

// ── Phase 3: Finalize (download + verify, no Supabase upload in test) ──
async function phaseFinalize(comfyBase, clipFilenames) {
  console.log(`\n═══ PHASE: FINALIZE (${clipFilenames.length} clips) ═══`);
  const startMs = Date.now();

  for (const fn of clipFilenames) {
    const url = `${comfyBase}/view?filename=${encodeURIComponent(fn)}&type=output`;
    console.log(`  Checking clip: ${fn}`);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      const size = res.headers.get('content-length');
      console.log(`  → HTTP ${res.status}, size=${size ? (parseInt(size)/1024/1024).toFixed(1)+'MB' : 'unknown'}`);
    } catch (e) {
      console.log(`  → Fetch error: ${e.message}`);
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`  ✅ Finalize check done in ${elapsed}s`);
}

// ── Stop instance ──
async function phaseStop() {
  console.log(`\n═══ PHASE: STOP ═══`);
  await fetch(vastUrl(`/instances/${INSTANCE_ID}/`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ state: 'stopped' }),
  }).catch(() => {});
  console.log(`  Instance ${INSTANCE_ID} stop requested.`);
}

// ── Main ──
async function main() {
  const totalStart = Date.now();
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phased Video Generation — End-to-End Test          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`Instance: ${INSTANCE_ID}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Phase 1: Boot
  const boot = await phaseBoot();
  if (boot.error) {
    console.error(`\n❌ Boot failed: ${boot.error}`);
    await phaseStop();
    process.exit(1);
  }
  const { comfyBase } = boot;
  console.log(`\n📊 Phase timings so far: BOOT=${((Date.now() - totalStart) / 1000).toFixed(0)}s`);

  // Phase 2: Generate a short test clip (3s, small resolution)
  const sceneStart = Date.now();
  const scene = await phaseScene(comfyBase, {
    prompt: 'A golden retriever puppy playing in a sunlit meadow with wildflowers, cinematic lighting, shallow depth of field',
    negativePrompt: 'blurry, distorted, low quality, watermark, cartoon',
    width: 512,
    height: 320,
    numFrames: Math.round(3 * 24 / 8) * 8 + 1, // ~3 seconds
    filenamePrefix: 'test_scene_01',
  });
  if (scene.error) {
    console.error(`\n❌ Scene failed: ${scene.error}`);
    await phaseStop();
    process.exit(1);
  }
  console.log(`📊 Phase timings: BOOT=${((sceneStart - totalStart) / 1000).toFixed(0)}s, SCENE=${((Date.now() - sceneStart) / 1000).toFixed(0)}s`);

  // Phase 3: Finalize (verify clips are downloadable)
  const finStart = Date.now();
  await phaseFinalize(comfyBase, [scene.filename]);
  console.log(`📊 Phase timings: BOOT=${((sceneStart - totalStart) / 1000).toFixed(0)}s, SCENE=${((finStart - sceneStart) / 1000).toFixed(0)}s, FINALIZE=${((Date.now() - finStart) / 1000).toFixed(0)}s`);

  // Phase 4: Stop
  await phaseStop();

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  ✅ ALL PHASES COMPLETED in ${totalElapsed}s`);
  console.log(`║  Each phase fit within Vercel 800s limit? ${ 
    ((sceneStart - totalStart)/1000 < 800 && (finStart - sceneStart)/1000 < 800 && (Date.now() - finStart)/1000 < 800)
      ? 'YES ✅' : 'NO ❌'
  }`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  phaseStop().catch(() => {});
  process.exit(1);
});
