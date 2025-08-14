// src/lib/links.ts
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function makeTrackedUrl({ emailId, businessId, dest }:
  { emailId: string; businessId: string; dest: string }) {
  const slug = nanoid(12);
  await supabase.from('clicks').insert({
    slug,
    email_id: emailId,
    business_id: businessId,
    dest_url: dest,
    created_at: new Date().toISOString()
  });
  const base = process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || '';
  return `${base}/api/r/${slug}`;
}

export async function decodeTrackingSlug(slug: string) {
  const { data } = await supabase
    .from('clicks')
    .select('id, email_id, business_id, dest_url')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}


