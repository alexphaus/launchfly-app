// src/lib/vision-inventory.ts
// Visual inventory comparison using GPT-4o Vision
// Downloads images from Evolution, uploads to Supabase Storage for URL access,
// then uses GPT-4o to compare current state vs golden state.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

// ─── Download image from Evolution and upload to Supabase Storage ─────────

interface DownloadImageInput {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  message: Record<string, unknown>;
  messageKey: Record<string, unknown>;
  businessId: string;
}

/**
 * Download an image from Evolution's media endpoint and upload it to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function downloadAndStoreImage(input: DownloadImageInput): Promise<string | null> {
  const { baseUrl, apiKey, instanceName, message, messageKey, businessId } = input;

  try {
    // 1. Download base64 via Evolution
    const url = `${baseUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey, message } }),
    });

    if (!res.ok) {
      console.warn(`[vision] Evolution media download failed: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const base64Data = json.base64 || json.mediaBase64 || json.data;
    if (!base64Data) {
      console.warn('[vision] No base64 data in Evolution response');
      return null;
    }

    // 2. Upload to Supabase Storage
    const supabase = getSupabase();
    const bucket = 'inventory-images';

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
    });

    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '86400',
      });

    if (uploadError) {
      console.error('[vision] Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
    console.log(`[vision] Image stored: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('[vision] Failed to download/store image:', err);
    return null;
  }
}

// ─── Save / retrieve golden state images ─────────────────────────────────

export async function saveGoldenStateImage(
  businessId: string,
  imageUrl: string,
  label?: string,
  category?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('golden_state_images')
    .insert({ business_id: businessId, image_url: imageUrl, label, category })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function getGoldenStateImages(businessId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('golden_state_images')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// ─── GPT-4o Vision comparison ────────────────────────────────────────────

interface CompareInventoryInput {
  currentImageUrl: string;
  goldenImageUrl: string;
  businessContext?: string; // e.g. "market stall selling jewelry and candles"
}

export interface InventoryDiff {
  missingItems: Array<{ item: string; estimatedQty?: number; location?: string }>;
  lowStockItems: Array<{ item: string; estimatedRemaining?: number; location?: string }>;
  summary: string;
  suggestedPO: string;
}

export async function compareInventoryImages(input: CompareInventoryInput): Promise<InventoryDiff> {
  const openai = getOpenAI();

  const systemPrompt = `You are a visual inventory analyst. You receive two images:
1. The GOLDEN STATE (fully stocked reference photo)
2. The CURRENT STATE (photo taken after a work day / market / shift)

Your job:
- Compare both images carefully
- Identify items that are MISSING (sold, used, or depleted)
- Identify items that are LOW STOCK (visibly reduced)
- Be specific about what items and where in the image
- Draft a suggested purchase order to restock

Respond in JSON format:
{
  "missingItems": [{"item": "description", "estimatedQty": number, "location": "where in the image"}],
  "lowStockItems": [{"item": "description", "estimatedRemaining": number, "location": "where in the image"}],
  "summary": "Brief human-readable summary of what needs restocking",
  "suggestedPO": "Formatted purchase order text ready to send to a supplier"
}

Be practical and business-oriented. The PO should be professional and ready to send.`;

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: `Compare these two images and identify what's missing or depleted.${input.businessContext ? `\n\nBusiness context: ${input.businessContext}` : ''}

Image 1 is the GOLDEN STATE (fully stocked).
Image 2 is the CURRENT STATE (after today).`,
    },
    {
      type: 'image_url',
      image_url: { url: input.goldenImageUrl, detail: 'high' },
    },
    {
      type: 'image_url',
      image_url: { url: input.currentImageUrl, detail: 'high' },
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const text = response.choices[0]?.message?.content || '';

  // Extract JSON from the response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as InventoryDiff;
    }
  } catch {
    // Fall through to default
  }

  return {
    missingItems: [],
    lowStockItems: [],
    summary: text,
    suggestedPO: '',
  };
}

// ─── Single image analysis (no golden state yet) ────────────────────────

export async function analyzeInventoryImage(imageUrl: string, businessContext?: string): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You are a visual inventory analyst. Describe what you see in this image in the context of a business inventory. List all visible products/items, estimate quantities, and note anything that appears low or empty. Be specific and practical.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: businessContext ? `Business context: ${businessContext}\n\nDescribe the inventory in this image.` : 'Describe the inventory in this image.' },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content || 'Could not analyze the image.';
}
