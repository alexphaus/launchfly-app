// /api/agent/video-generate — Phased video generation endpoint.
// Called via Upstash Workflow context.call() in a loop. Each call handles ONE
// phase (boot → scene → finalize), fitting within Vercel's 800s maxDuration.
// State is passed in the request/response body — fully stateless between calls.

import { NextRequest, NextResponse } from 'next/server';
import { vastBoot, vastGenerateClip, vastFinalizeVideo, vastStop, type ToolContext } from '@/lib/agent/tools';

export const maxDuration = 800;

/** State passed between phases via the workflow runner loop */
interface VideoState {
  phase: 'scene' | 'finalize';
  comfyBase: string;
  instanceId: string;
  scenes: Array<{ prompt: string; duration?: number }>;
  width: number;
  height: number;
  negativePrompt: string;
  businessId: string;
  clipFilenames: string[];
  nextScene: number;
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { toolName, args, toolCtx, state } = body as {
      toolName: string;
      args: Record<string, unknown>;
      toolCtx: ToolContext;
      state?: VideoState;
    };

    const instanceId = process.env.VAST_INSTANCE_ID;
    if (!instanceId) return NextResponse.json({ done: true, result: 'Error: VAST_INSTANCE_ID not set.' });
    if (!process.env.VASTAI_API_KEY) return NextResponse.json({ done: true, result: 'Error: VASTAI_API_KEY not set.' });

    // ── Phase: BOOT (no state yet) ──
    if (!state) {
      console.log(`[video-generate] Phase: BOOT for ${toolName}`);
      const boot = await vastBoot(instanceId);
      if ('error' in boot) {
        console.error(`[video-generate] Boot failed: ${boot.error}`);
        return NextResponse.json({ done: true, result: boot.error });
      }

      const negativePrompt = (args.negative_prompt as string) || 'blurry, distorted, low quality, watermark, cartoon';
      const width = (args.width as number) || 768;
      const height = (args.height as number) || 512;

      // Build scenes array from args
      let scenes: Array<{ prompt: string; duration?: number }>;
      if (toolName === 'generate_long_video') {
        scenes = args.scenes as Array<{ prompt: string; duration?: number }>;
        if (!scenes?.length || scenes.length < 2) return NextResponse.json({ done: true, result: 'Error: scenes array must have at least 2 scenes.' });
      } else {
        const prompt = (args.prompt as string || '').trim();
        if (!prompt) return NextResponse.json({ done: true, result: 'Error: prompt is required.' });
        scenes = [{ prompt, duration: (args.duration as number) || 5 }];
      }

      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`[video-generate] Boot completed in ${elapsed}s → ${boot.comfyBase}, ${scenes.length} scenes queued`);

      return NextResponse.json({
        done: false,
        state: {
          phase: 'scene',
          comfyBase: boot.comfyBase,
          instanceId,
          scenes,
          width,
          height,
          negativePrompt,
          businessId: toolCtx.businessId,
          clipFilenames: [],
          nextScene: 0,
        } satisfies VideoState,
      });
    }

    // ── Phase: SCENE (generate one clip) ──
    if (state.phase === 'scene') {
      const scene = state.scenes[state.nextScene];
      const sceneDuration = Math.min(Math.max(scene.duration || (state.scenes.length === 1 ? 5 : 15), 2), 20);
      const numFrames = Math.round(sceneDuration * 24 / 8) * 8 + 1;

      console.log(`[video-generate] Phase: SCENE ${state.nextScene + 1}/${state.scenes.length}`);
      const clip = await vastGenerateClip(state.comfyBase, {
        prompt: scene.prompt,
        negativePrompt: state.negativePrompt,
        width: state.width,
        height: state.height,
        numFrames,
        filenamePrefix: `scene_${String(state.nextScene + 1).padStart(2, '0')}`,
      });

      if ('error' in clip) {
        console.error(`[video-generate] Scene ${state.nextScene + 1} failed: ${clip.error}`);
        await vastStop(state.instanceId);
        return NextResponse.json({ done: true, result: `${clip.error} Instance stopped.` });
      }

      const newClips = [...state.clipFilenames, clip.filename];
      const allDone = state.nextScene + 1 >= state.scenes.length;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`[video-generate] Scene ${state.nextScene + 1} done in ${elapsed}s → ${clip.filename}`);

      return NextResponse.json({
        done: false,
        state: {
          ...state,
          clipFilenames: newClips,
          nextScene: state.nextScene + 1,
          phase: allDone ? 'finalize' : 'scene',
        } satisfies VideoState,
      });
    }

    // ── Phase: FINALIZE (concat + upload + stop) ──
    if (state.phase === 'finalize') {
      console.log(`[video-generate] Phase: FINALIZE (${state.clipFilenames.length} clips)`);

      const upload = await vastFinalizeVideo(state.comfyBase, state.clipFilenames, state.businessId);
      await vastStop(state.instanceId);

      if ('error' in upload && !('url' in upload)) {
        console.error(`[video-generate] Finalize failed: ${upload.error}`);
        return NextResponse.json({ done: true, result: `${upload.error} Instance stopped.` });
      }

      const url = (upload as { url: string }).url;
      const totalScenes = state.scenes.length;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`[video-generate] Finalize done in ${elapsed}s → ${url}`);

      const result = totalScenes === 1
        ? `✅ Video generated via Vast.ai + LTX Video 2.3 (with audio)\nVideo URL: ${url}\nResolution: ${state.width}x${state.height}\nModel: LTX 2.3 distilled (8 steps)\nInstance ${state.instanceId} stopped (disk preserved).`
        : `✅ Long video generated via Vast.ai + LTX Video 2.3\nVideo URL: ${url}\nScenes: ${totalScenes} clips stitched\nResolution: ${state.width}x${state.height}\nInstance ${state.instanceId} stopped (disk preserved).`;

      return NextResponse.json({ done: true, result });
    }

    return NextResponse.json({ done: true, result: `Unknown phase: ${state.phase}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[video-generate] Unhandled error:', message);
    // Try to stop instance on crash
    const instanceId = process.env.VAST_INSTANCE_ID;
    if (instanceId) await vastStop(instanceId).catch(() => {});
    return NextResponse.json({ done: true, result: `Video generation error: ${message}. Instance stopped.` });
  }
}
