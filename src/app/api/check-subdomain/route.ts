// src/app/api/check-subdomain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain parameter is required' },
        { status: 400 }
      );
    }

    // Clean and validate subdomain format
    const cleanSubdomain = subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);

    if (cleanSubdomain.length < 3) {
      return NextResponse.json({
        available: false,
        error: 'Subdomain must be at least 3 characters long',
        suggestion: null
      });
    }

    // Reserved subdomains
    const reserved = [
      'www', 'api', 'admin', 'app', 'mail', 'ftp', 'blog', 'shop', 'store',
      'support', 'help', 'docs', 'dev', 'staging', 'test', 'demo', 'cdn',
      'static', 'assets', 'images', 'files', 'downloads', 'uploads',
      'dashboard', 'panel', 'console', 'account', 'profile', 'settings',
      'billing', 'payment', 'checkout', 'cart', 'order', 'orders',
      'launchfly', 'launch', 'fly'
    ];

    if (reserved.includes(cleanSubdomain)) {
      return NextResponse.json({
        available: false,
        error: 'This subdomain is reserved',
        suggestion: `${cleanSubdomain}-${Math.random().toString(36).substr(2, 4)}`
      });
    }

    // Check if subdomain exists in database
    const { data: existingBusiness, error: dbError } = await supabase
      .from('businesses')
      .select('id, subdomain')
      .eq('subdomain', cleanSubdomain)
      .maybeSingle();

    if (dbError) {
      console.error('Database error checking subdomain:', dbError);
      return NextResponse.json(
        { error: 'Failed to check subdomain availability' },
        { status: 500 }
      );
    }

    const available = !existingBusiness;
    let suggestion = null;

    if (!available) {
      // Generate suggestion
      const randomSuffix = Math.random().toString(36).substr(2, 4);
      suggestion = `${cleanSubdomain}-${randomSuffix}`;
    }

    return NextResponse.json({
      available,
      subdomain: cleanSubdomain,
      suggestion,
      error: null
    });

  } catch (error) {
    console.error('Subdomain check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
