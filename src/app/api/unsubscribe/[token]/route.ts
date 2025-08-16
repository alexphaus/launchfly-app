// src/app/api/unsubscribe/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function decodeToken(token: string): { email: string; businessId: string } | null {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (typeof parsed.email === 'string' && typeof parsed.businessId === 'string') {
      return { email: parsed.email.toLowerCase(), businessId: parsed.businessId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const decoded = token ? decodeToken(token) : null;
    if (!decoded) {
      return new NextResponse('Invalid unsubscribe token', { status: 400 });
    }

    const { email } = decoded;

    await supabase
      .from('suppression_list')
      .upsert({ email, reason: 'unsubscribe' }, { onConflict: 'email' });

    const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Unsubscribed</title></head><body style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;padding:32px;max-width:640px;margin:0 auto;line-height:1.6"><h1 style="font-size:20px;margin:0 0 12px">You're unsubscribed</h1><p>You will no longer receive emails from us at <strong>${email}</strong>.</p></body></html>`;
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e: any) {
    return new NextResponse(`Server error: ${e?.message || 'unknown'}`, { status: 500 });
  }
}

export const runtime = 'nodejs';


