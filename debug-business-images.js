const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkBusinessProducts() {
  try {
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', '54c0ec82-d17b-41b2-9442-0163a3b7b9a4')
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('🏢 Business:', business.name);
    console.log('📅 Created:', business.created_at);
    console.log('🌐 Subdomain:', business.subdomain);
    console.log('💾 Has business_data:', !!business.business_data);
    
    if (business.business_data?.products) {
      console.log('\n📦 Products:', business.business_data.products.length);
      
      business.business_data.products.forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.name}`);
        console.log(`   💰 Price: ${product.price}`);
        console.log(`   🖼️  Has images: ${product.images ? product.images.length : 0}`);
        
        if (product.images && product.images.length > 0) {
          console.log(`   📸 First image URL: ${product.images[0].substring(0, 80)}...`);
          console.log(`   🕒 Generated at: ${product.imageGeneratedAt || 'N/A'}`);
          
          // Check if the URL is accessible
          console.log(`   🔗 URL starts with: ${product.images[0].startsWith('https://') ? 'HTTPS ✅' : 'NOT HTTPS ❌'}`);
        }
      });
    } else {
      console.log('❌ No products found');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkBusinessProducts();
