const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugRecentBusinesses() {
  try {
    console.log('🔍 Checking recent businesses...\n');
    
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('❌ Error fetching businesses:', error);
      return;
    }

    for (const business of businesses) {
      console.log(`🏢 ${business.name} (${business.subdomain})`);
      console.log(`   📅 Created: ${business.created_at}`);
      console.log(`   🆔 ID: ${business.id}`);
      
      if (business.business_data?.products) {
        console.log(`   📦 Products: ${business.business_data.products.length}`);
        
        const productsWithImages = business.business_data.products.filter(p => p.images && p.images.length > 0);
        console.log(`   🖼️  Products with images: ${productsWithImages.length}`);
        
        if (productsWithImages.length > 0) {
          console.log('   📸 Sample images:');
          productsWithImages.slice(0, 2).forEach(product => {
            console.log(`      - ${product.name}: ${product.images[0].substring(0, 60)}...`);
          });
        }
      } else {
        console.log('   ❌ No products found');
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugRecentBusinesses();
