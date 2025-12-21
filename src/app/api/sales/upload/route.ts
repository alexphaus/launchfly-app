import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `sales-prospect/${timestamp}-${randomId}.${extension}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Determine image type from original filename
      let imageType = 'general';
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('before') || lowerName.includes('problem')) {
        imageType = 'before';
      } else if (lowerName.includes('after') || lowerName.includes('solution') || lowerName.includes('result')) {
        imageType = 'after';
      } else if (lowerName.includes('team') || lowerName.includes('technician') || lowerName.includes('staff')) {
        imageType = 'team';
      } else if (lowerName.includes('work') || lowerName.includes('service') || lowerName.includes('job')) {
        imageType = 'work';
      }

      uploadedUrls.push({
        url: publicUrl,
        type: imageType,
        name: file.name
      });
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

// Increase body size limit for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
