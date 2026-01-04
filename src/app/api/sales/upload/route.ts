import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Simple in-memory hash cache (in production, use Redis or DB)
// This persists during server runtime
const hashCache = new Map<string, { url: string; type: string; name: string }>();

// Compute MD5 hash of file content
function computeHash(buffer: Uint8Array): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedUrls: { url: string; type: string; name: string }[] = [];

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue; // Skip non-image files
      }

      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({
          error: `File ${file.name} exceeds 5MB limit`
        }, { status: 400 });
      }

      // Convert File to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Compute hash for deduplication
      const fileHash = computeHash(buffer);

      // Check if we've seen this file before (in-memory cache)
      if (hashCache.has(fileHash)) {
        const existing = hashCache.get(fileHash)!;
        uploadedUrls.push({
          url: existing.url,
          type: existing.type,
          name: file.name // Use current filename
        });
        console.log(`♻️ Reusing existing image (hash: ${fileHash.slice(0, 8)}...)`);
        continue;
      }

      // Check if file exists in storage (by hash-based filename)
      const extension = file.name.split('.').pop() || 'jpg';
      const hashFileName = `sales-prospect/dedup-${fileHash}.${extension}`;

      // Try to get existing file by hash name
      const { data: existingFile } = supabase.storage
        .from('product-images')
        .getPublicUrl(hashFileName);

      // Check if the file actually exists by trying to download metadata
      const { data: checkExists } = await supabase.storage
        .from('product-images')
        .list('sales-prospect', { search: `dedup-${fileHash}` });

      if (checkExists && checkExists.length > 0) {
        // File already exists, use existing URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(`sales-prospect/${checkExists[0].name}`);

        // Determine image type
        let imageType = determineImageType(file.name);

        const result = { url: publicUrl, type: imageType, name: file.name };
        hashCache.set(fileHash, result);
        uploadedUrls.push(result);
        console.log(`♻️ Found existing file in storage (hash: ${fileHash.slice(0, 8)}...)`);
        continue;
      }

      // New file - upload with hash-based name
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(hashFileName, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true // Just in case
        });

      if (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(hashFileName);

      // Determine image type from original filename
      let imageType = determineImageType(file.name);

      const result = { url: publicUrl, type: imageType, name: file.name };
      hashCache.set(fileHash, result);
      uploadedUrls.push(result);
      console.log(`📤 Uploaded new image (hash: ${fileHash.slice(0, 8)}...)`);
    }

    return NextResponse.json({
      success: true,
      images: uploadedUrls
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function determineImageType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.includes('before') || lowerName.includes('problem')) {
    return 'before';
  } else if (lowerName.includes('after') || lowerName.includes('solution') || lowerName.includes('result')) {
    return 'after';
  } else if (lowerName.includes('team') || lowerName.includes('technician') || lowerName.includes('staff')) {
    return 'team';
  } else if (lowerName.includes('work') || lowerName.includes('service') || lowerName.includes('job')) {
    return 'work';
  }
  return 'general';
}

export const maxDuration = 60;

