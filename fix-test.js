const fs = require('fs');
let code = fs.readFileSync('test-vast-video.mjs', 'utf8');

// Update onstart script
code = code.replace(
  /onstart: 'bash -c "mkdir -p \/root\/ComfyUI\/models\/checkpoints[^"']+/,
  'onstart: \'bash -c "mkdir -p /root/ComfyUI/models/checkpoints && wget -qO /root/ComfyUI/models/checkpoints/ltxv-2b-0.9.8-distilled-fp8.safetensors https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltxv-2b-0.9.8-distilled-fp8.safetensors"'
);

// Update workflow to use LTXV nodes
const oldWorkflowStr = code.match(/const workflow = \{[\s\S]+?  \};\n\n  const queueRes/)[0];

const newWorkflow = `const workflow = {
    "3": {
      "class_type": "LTXVConditioning",
      "inputs": {
        "positive": ["1", 0],
        "negative": ["2", 0]
      }
    },
    "4": {
      "class_type": "LTXVScheduler",
      "inputs": {
        "latent": ["5", 0],
        "steps": steps,
        "sigmas": ["4", 0] // will be overwritten, ignored
      }
    },
    "5": {
      "class_type": "EmptyLTXVLatentVideo",
      "inputs": {
        "width": width,
        "height": height,
        "length": numFrames,
        "batch_size": 1
      }
    },
    "6": {
      "class_type": "SamplerCustom",
      "inputs": {
        "model": ["8", 0],
        "positive": ["3", 0],
        "negative": ["3", 1],
        "sampler": ["7", 0],
        "sigmas": ["4", 0],
        "latent_image": ["5", 0]
      }
    },
    "7": {
      "class_type": "KSamplerSelect",
      "inputs": { "sampler_name": "euler" }
    },
    "8": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": { "ckpt_name": "ltxv-2b-0.9.8-distilled-fp8.safetensors" }
    },
    "9": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["6", 0], "vae": ["8", 2] }
    },
    "10": {
      "class_type": "SaveAnimatedWEBP",
      "inputs": { "images": ["9", 0], "filename_prefix": "ltx_output", "fps": 24, "quality": 90, "method": "default" }
    },
    "1": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": prompt, "clip": ["8", 1] } // using checkpoint's CLIP if available, otherwise need separate t5 load
    },
    "2": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": negativePrompt, "clip": ["8", 1] }
    }
  };

  const queueRes`;

code = code.replace(oldWorkflowStr, newWorkflow);
fs.writeFileSync('test-vast-video.mjs', code);
