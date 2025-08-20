const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeImageUrls() {
  try {
    console.log('🔍 Analyzing image URLs for ModernMan Skin Co...\n');
    
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', 'modernmanskinco')
      .single();

    if (error || !business) {
      console.error('❌ Business not found:', error);
      return;
    }

    if (!business.business_data?.products) {
      console.log('❌ No products found');
      return;
    }

    console.log(`🏢 Business: ${business.name}`);
    console.log(`📦 Total products: ${business.business_data.products.length}\n`);

    for (const product of business.business_data.products) {
      console.log(`📸 Product: ${product.name}`);
      
      if (product.images && product.images.length > 0) {
        console.log(`   🖼️  Images: ${product.images.length}`);
        
        product.images.forEach((imageUrl, index) => {
          console.log(`   ${index + 1}. ${imageUrl}`);
          
          // Extract expiration info from URL
          if (imageUrl.includes('se=')) {
            const seMatch = imageUrl.match(/se=([^&]+)/);
            if (seMatch) {
              const expiryDate = new Date(decodeURIComponent(seMatch[1]));
              const now = new Date();
              const isExpired = now > expiryDate;
              
              console.log(`      ⏰ Expires: ${expiryDate.toISOString()}`);
              console.log(`      ${isExpired ? '❌ EXPIRED' : '✅ Valid'} (${Math.round((expiryDate - now) / (1000 * 60 * 60))} hours remaining)`);
            }
          }
        });
        
        console.log(`   🕒 Generated: ${product.imageGeneratedAt || 'Unknown'}`);
      } else {
        console.log('   ❌ No images');
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

analyzeImageUrls();
