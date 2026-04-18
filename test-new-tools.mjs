// Quick smoke tests for generate_media, post_social (Postiz), generate_video
// Run: node test-new-tools.mjs [test_name]
// Tests: runware, postiz_check, vast_check, runware_video, runware_audio

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const test = process.argv[2] || 'runware';

// ═══════════════════════════════════════════
// Test 1: Runware Image Generation
// ═══════════════════════════════════════════
async function testRunware() {
  console.log('\n🎨 Testing Runware image generation...\n');
  
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) { console.error('❌ RUNWARE_API_KEY not set'); return; }
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);

  const { Runware } = await import('@runware/sdk-js');
  const runware = new Runware({ apiKey, timeoutDuration: 60000 });
  await runware.ensureConnection();
  console.log('  ✅ Connected to Runware');

  try {
    const images = await runware.imageInference({
      positivePrompt: 'A professional photo of a clean modern office with natural light, minimalist design',
      negativePrompt: 'blurry, low quality, watermark',
      model: 'runware:100@1', // FLUX Schnell
      width: 1024,
      height: 1024,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'WEBP',
      includeCost: true,
    });

    console.log(`  ✅ Generated ${images.length} image(s)`);
    for (const img of images) {
      console.log(`     URL: ${img.imageURL}`);
      console.log(`     Cost: $${img.cost?.toFixed(4) || 'unknown'}`);
    }
  } catch (err) {
    console.error('  ❌ Image generation failed:', err.message);
  } finally {
    await runware.disconnect().catch(() => {});
  }
}

// ═══════════════════════════════════════════
// Test 2: Runware Video Generation
// ═══════════════════════════════════════════
async function testRunwareVideo() {
  console.log('\n🎬 Testing Runware video generation...\n');
  
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) { console.error('❌ RUNWARE_API_KEY not set'); return; }

  const { Runware } = await import('@runware/sdk-js');
  const runware = new Runware({ apiKey, timeoutDuration: 120000 });
  await runware.ensureConnection();
  console.log('  ✅ Connected to Runware');

  try {
    const videos = await runware.videoInference({
      positivePrompt: 'A gentle sunrise over a city skyline, timelapse style, warm golden light',
      model: 'runware:101@1',
      width: 768,
      height: 512,
      includeCost: true,
      outputType: 'URL',
    });

    const arr = Array.isArray(videos) ? videos : [videos];
    console.log(`  ✅ Generated ${arr.length} video(s)`);
    for (const v of arr) {
      console.log(`     URL: ${v.videoURL || v.imageURL || JSON.stringify(v)}`);
      console.log(`     Cost: $${v.cost?.toFixed(4) || 'unknown'}`);
    }
  } catch (err) {
    console.error('  ❌ Video generation failed:', err.message);
    console.log('  (This is OK — video models may require a specific model ID from runware.ai/models)');
  } finally {
    await runware.disconnect().catch(() => {});
  }
}

// ═══════════════════════════════════════════
// Test 3: Runware Audio Generation  
// ═══════════════════════════════════════════
async function testRunwareAudio() {
  console.log('\n🎵 Testing Runware audio generation...\n');
  
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) { console.error('❌ RUNWARE_API_KEY not set'); return; }

  const { Runware } = await import('@runware/sdk-js');
  const runware = new Runware({ apiKey, timeoutDuration: 120000 });
  await runware.ensureConnection();
  console.log('  ✅ Connected to Runware');

  try {
    const audio = await runware.audioInference({
      positivePrompt: 'upbeat corporate background music, modern, inspiring',
      model: 'elevenlabs:1@1',
      outputType: 'URL',
      outputFormat: 'MP3',
      includeCost: true,
      numberResults: 1,
      duration: 10,
    });

    const arr = Array.isArray(audio) ? audio : [audio];
    console.log(`  ✅ Generated ${arr.length} audio(s)`);
    for (const a of arr) {
      console.log(`     URL: ${a.audioURL || JSON.stringify(a)}`);
      console.log(`     Cost: $${a.cost?.toFixed(4) || 'unknown'}`);
    }
  } catch (err) {
    console.error('  ❌ Audio generation failed:', err.message);
    console.log('  (This is OK — audio models may require specific model IDs)');
  } finally {
    await runware.disconnect().catch(() => {});
  }
}

// ═══════════════════════════════════════════
// Test 4: Postiz Integration Check
// ═══════════════════════════════════════════
async function testPostizCheck() {
  console.log('\n📱 Checking Postiz integration...\n');

  // Check if integration exists
  const { data: integration, error } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .eq('service_name', 'postiz')
    .maybeSingle();

  if (error) {
    console.error('  ❌ DB error:', error.message);
    return;
  }

  if (!integration) {
    console.log('  ⚠️  No Postiz integration found.');
    console.log('  To set up, you need a Postiz API key from:');
    console.log('    - Self-hosted: your Postiz instance → Settings → Developers → Public API');
    console.log('    - Cloud: https://app.postiz.com → Settings → Developers → Public API');
    console.log('');
    console.log('  Then run this SQL:');
    console.log(`
    INSERT INTO business_integrations (business_id, service_name, api_key_encrypted, base_url, status, description)
    VALUES (
      '${BUSINESS_ID}',
      'postiz',
      'YOUR_POSTIZ_API_KEY_HERE',
      'https://api.postiz.com/public/v1',
      'active',
      'Postiz social media scheduling (32 platforms)'
    );
    `);
    return;
  }

  console.log(`  ✅ Postiz integration found (status: ${integration.status})`);
  console.log(`     Base URL: ${integration.base_url || 'https://api.postiz.com/public/v1'}`);
  console.log(`     API Key: ${integration.api_key_encrypted?.substring(0, 8)}...`);

  // Test the connection
  const baseUrl = (integration.base_url || 'https://api.postiz.com/public/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/integrations`, {
      headers: { 'Authorization': integration.api_key_encrypted },
    });
    if (!res.ok) {
      console.error(`  ❌ Postiz API returned HTTP ${res.status}`);
      const body = await res.text();
      console.error(`     ${body.substring(0, 200)}`);
      return;
    }
    const channels = await res.json();
    console.log(`  ✅ Connected! ${channels.length} channel(s) available:`);
    for (const ch of channels) {
      console.log(`     • ${ch.providerIdentifier} — ${ch.name || ch.id}`);
    }
  } catch (err) {
    console.error('  ❌ Connection failed:', err.message);
  }
}

// ═══════════════════════════════════════════
// Test 5: Vast.ai Account Check
// ═══════════════════════════════════════════
async function testVastCheck() {
  console.log('\n🖥️  Checking Vast.ai account...\n');

  const apiKey = process.env.VASTAI_API_KEY;
  if (!apiKey) { console.error('❌ VASTAI_API_KEY not set'); return; }
  console.log(`  API Key: ${apiKey.substring(0, 12)}...`);

  const vastBase = 'https://console.vast.ai/api/v0';
  const authParam = `api_key=${encodeURIComponent(apiKey)}`;
  const vastUrl = (path) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${vastBase}${path}${sep}${authParam}`;
  };

  // Check account balance
  try {
    const res = await fetch(vastUrl('/users/current/'), {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.error(`  ❌ Vast.ai API returned HTTP ${res.status}`);
      const body = await res.text();
      console.error(`     ${body.substring(0, 200)}`);
      return;
    }
    const user = await res.json();
    console.log(`  ✅ Account: ${user.username || user.email || 'connected'}`);
    console.log(`     Balance: $${user.credit?.toFixed(2) || 'unknown'}`);
  } catch (err) {
    console.error('  ❌ Connection failed:', err.message);
    return;
  }

  // Check existing instances
  try {
    const res = await fetch(vastUrl('/instances/?owner=me'), {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const instances = data.instances || [];
      if (instances.length) {
        console.log(`  ⚠️  ${instances.length} running instance(s):`);
        for (const inst of instances) {
          console.log(`     • ID ${inst.id}: ${inst.gpu_name} — ${inst.actual_status} — $${inst.dph_total?.toFixed(3)}/hr — label: "${inst.label || 'none'}"`);
        }
      } else {
        console.log('  ✅ No running instances (clean — no costs accruing)');
      }
    }
  } catch (err) {
    console.error('  ⚠️  Could not list instances:', err.message);
  }

  // Check cheapest RTX 4090 availability
  try {
    const q = encodeURIComponent(JSON.stringify({
      gpu_name: 'RTX 4090', num_gpus: 1, disk_space: 25,
      reliability2: { gte: 0.9 }, inet_down: { gte: 100 },
      order: [['dph_total', 'asc']], type: 'on-demand', limit: 3,
    }));
    const res = await fetch(vastUrl(`/bundles/?q=${q}`), {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const offers = data.offers || [];
      if (offers.length) {
        console.log(`  ✅ RTX 4090 availability (top 3 cheapest):`);
        for (const o of offers) {
          console.log(`     • $${o.dph_total?.toFixed(3)}/hr — ${o.gpu_name} ${o.gpu_ram}GB — ${o.inet_down}Mbps down — reliability ${(o.reliability2 * 100).toFixed(0)}%`);
        }
      } else {
        console.log('  ⚠️  No RTX 4090 offers available right now');
      }
    }
  } catch (err) {
    console.error('  ⚠️  Could not search offers:', err.message);
  }

  // Check Supabase bucket for video storage
  console.log('\n  📦 Checking Supabase storage bucket...');
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasBucket = buckets?.some(b => b.name === 'generated-media');
  if (hasBucket) {
    console.log('  ✅ generated-media bucket exists');
  } else {
    console.log('  ⚠️  generated-media bucket not found (will be auto-created on first use)');
    const { error: createErr } = await supabase.storage.createBucket('generated-media', { public: true });
    if (createErr) {
      console.log(`  ❌ Failed to create bucket: ${createErr.message}`);
    } else {
      console.log('  ✅ Created generated-media bucket');
    }
  }
}

// ═══════════════════════════════════════════
// Run selected test
// ═══════════════════════════════════════════
const tests = {
  runware: testRunware,
  runware_video: testRunwareVideo,
  runware_audio: testRunwareAudio,
  postiz_check: testPostizCheck,
  vast_check: testVastCheck,
  all: async () => {
    await testRunware();
    await testPostizCheck();
    await testVastCheck();
  },
};

if (!tests[test]) {
  console.log(`Unknown test: ${test}`);
  console.log(`Available: ${Object.keys(tests).join(', ')}`);
  process.exit(1);
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Running test: ${test}`);
console.log(`${'═'.repeat(50)}`);

tests[test]().then(() => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  Done!');
  console.log(`${'═'.repeat(50)}\n`);
  process.exit(0);
}).catch(err => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
