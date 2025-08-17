// update-product-images.js
// Script to update product images in the database with the generated AI images

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// The generated image URLs from our recent run
const generatedImages = {
  'gentleman-glow-sensitive-skin-starter-kit': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-hIq2dRFkRBZeUJpaR0kYBumy.png?st=2025-08-17T11%3A00%3A41Z&se=2025-08-17T13%3A00%3A41Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=31d50bd4-689f-439b-a875-f22bd677744d&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-16T20%3A12%3A19Z&ske=2025-08-17T20%3A12%3A19Z&sks=b&skv=2024-08-04&sig=Jlv/ViPjbfo%2BUSAmACjtdMrjFYiYNjfaSFvxJT0YinU%3D'
  ],
  'gentleman-glow-soothing-face-wash': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-6qTb6HCBWA53sTrQI7cQCsrx.png?st=2025-08-17T11%3A01%3A00Z&se=2025-08-17T13%3A01%3A00Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=8eb2c87c-0531-4dab-acb3-b5e2adddce6c&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-16T12%3A21%3A06Z&ske=2025-08-17T12%3A21%3A06Z&sks=b&skv=2024-08-04&sig=wM2GMHInObp7j7DMyvZVKq/XWU7lOwtDwc4kaj/g6sI%3D'
  ],
  'gentleman-glow-rejuvenating-moisturizer': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-SpB5ATqVmf9aDER9d0Ip1lDm.png?st=2025-08-17T11%3A01%3A18Z&se=2025-08-17T13%3A01%3A18Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=b2c0e1c0-cf97-4e19-8986-8073905d5723&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-17T05%3A32%3A31Z&ske=2025-08-18T05%3A32%3A31Z&sks=b&skv=2024-08-04&sig=nNQFjDsbdTu9hb3/W9npm0M%2BNCUPGZ0dc7dMYq%2BUi54%3D'
  ],
  'gentleman-glow-protective-spf-lotion': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-OT59ytkD08tvx1NuWXv5ecAd.png?st=2025-08-17T11%3A01%3A39Z&se=2025-08-17T13%3A01%3A39Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=c6569cb0-0faa-463d-9694-97df3dc1dfb1&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-17T02%3A23%3A30Z&ske=2025-08-18T02%3A23%3A30Z&sks=b&skv=2024-08-04&sig=hUntklLcLylWPBjvoGhSPsSEiQn4mhGycMe/UHmRARQ%3D'
  ],
  'gentleman-glow-calming-shave-balm': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-aTHPG90JWXg3bcJt7RUzlZfh.png?st=2025-08-17T11%3A01%3A58Z&se=2025-08-17T13%3A01%3A58Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=6e4237ed-4a31-4e1d-a677-4df21834ece0&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-17T12%3A01%3A58Z&ske=2025-08-18T12%3A01%3A58Z&sks=b&skv=2024-08-04&sig=zt34kpdule8KMwhULiVit4l6CjQL74ybS7TVCDEzBr8%3D'
  ],
  'gentleman-glow-detoxifying-clay-mask': [
    'https://oaidalleapiprodscus.blob.core.windows.net/private/org-HhoTh9cguQLMo41Y3lqKdOo3/user-kpXHOPJLOdAf1lPwVQxeIPfO/img-QyUJZtTnk3MY3Y7eZcba0CQn.png?st=2025-08-17T11%3A02%3A15Z&se=2025-08-17T13%3A02%3A15Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=32836cae-d25f-4fe9-827b-1c8c59c442cc&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-17T11%3A39%3A27Z&ske=2025-08-18T11%3A39%3A27Z&sks=b&skv=2024-08-04&sig=vfUfp4OxNzIjaTpGt6tQ7NvRSsW4SWrGDGIR7m3KaFc%3D'
  ]
};

async function updateProductImages() {
  console.log('🔄 Updating product images in database...\n');
  
  try {
    const businessId = '5f82d853-7d5a-447c-884d-0692a382cd43';
    
    // Get the current business data
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching business:', fetchError);
      return;
    }
    
    if (!business.products || business.products.length === 0) {
      console.log('❌ No products found in business');
      return;
    }
    
    console.log(`📦 Found ${business.products.length} products to update`);
    
    // Update each product with its AI-generated image
    const updatedProducts = business.products.map(product => {
      const productId = product.id;
      const aiImages = generatedImages[productId];
      
      if (aiImages && aiImages.length > 0) {
        console.log(`✅ Updating ${product.name} with AI image`);
        return {
          ...product,
          images: aiImages  // Replace placeholder images with AI-generated ones
        };
      } else {
        console.log(`⚠️ No AI image found for ${product.name} (${productId})`);
        return product; // Keep original if no AI image available
      }
    });
    
    // Update the business in the database
    const { data: updateResult, error: updateError } = await supabase
      .from('businesses')
      .update({
        products: updatedProducts,
        businessData: {
          ...business.businessData,
          products: updatedProducts
        }
      })
      .eq('id', businessId);
    
    if (updateError) {
      console.error('❌ Error updating business:', updateError);
      return;
    }
    
    console.log('\n🎉 Successfully updated product images in database!');
    console.log(`✅ ${updatedProducts.length} products updated`);
    console.log('\n🌐 Your store now shows AI-generated images:');
    console.log('   → http://localhost:3000/sites/gentlemanglow');
    console.log('\n💡 Product detail pages will now display professional photos!');
    
  } catch (error) {
    console.error('❌ Error updating product images:', error);
  }
}

updateProductImages();
