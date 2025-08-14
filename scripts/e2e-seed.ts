// scripts/e2e-seed.ts
import { createClient } from '@supabase/supabase-js';
import { validateOffer } from '../src/lib/offer-validate';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: biz } = await supabase
    .from('businesses')
    .insert({ name: 'Logo Design', subdomain: 'logo-design', manual_approval_required: true })
    .select('id')
    .single();
  const businessId = biz!.id as string;

  // Seed prospects from CSV niche "logo-design"
  await validateOffer({ businessId, niche: 'logo-design', variantA: 'We help startups launch a standout logo in 48h.', variantB: 'We design conversion-optimized brand kits fast.' });

  const deepLink = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/api/metrics/${businessId}.json`;
  console.log('Metrics link:', deepLink);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


