import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Stock image categories organized by service type
const STOCK_FOLDERS = ['stock-aircon', 'stock-pest', 'stock-cleaning', 'stock-plumbing', 'stock-general'];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category'); // Optional filter

        const allImages: { url: string; type: string; name: string; category: string }[] = [];

        // Fetch from each stock folder
        for (const folder of STOCK_FOLDERS) {
            if (category && !folder.includes(category)) continue;

            const { data: files, error } = await supabase.storage
                .from('product-images')
                .list(folder, { limit: 50 });

            if (error) {
                console.error(`Error listing ${folder}:`, error);
                continue;
            }

            if (files && files.length > 0) {
                for (const file of files) {
                    if (!file.name || file.name.startsWith('.')) continue;

                    const { data: { publicUrl } } = supabase.storage
                        .from('product-images')
                        .getPublicUrl(`${folder}/${file.name}`);

                    // Determine type from filename
                    let imageType = 'general';
                    const lowerName = file.name.toLowerCase();
                    if (lowerName.includes('before') || lowerName.includes('problem')) {
                        imageType = 'before';
                    } else if (lowerName.includes('after') || lowerName.includes('result')) {
                        imageType = 'after';
                    } else if (lowerName.includes('team') || lowerName.includes('technician')) {
                        imageType = 'team';
                    } else if (lowerName.includes('work') || lowerName.includes('service')) {
                        imageType = 'work';
                    }

                    allImages.push({
                        url: publicUrl,
                        type: imageType,
                        name: file.name,
                        category: folder.replace('stock-', '')
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            images: allImages,
            categories: STOCK_FOLDERS.map(f => f.replace('stock-', ''))
        });

    } catch (error) {
        console.error('Stock images error:', error);
        return NextResponse.json({ error: 'Failed to load stock images' }, { status: 500 });
    }
}
