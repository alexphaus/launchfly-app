// find-businesses.js
// Quick script to find all businesses in the database

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findAllBusinesses() {
  console.log('🔍 Finding all businesses in database...\n');
  
  try {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    if (!businesses || businesses.length === 0) {
      console.log('📭 No businesses found in database');
      return;
    }
    
    console.log(`📊 Found ${businesses.length} business(es):\n`);
    
    businesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name || 'Unnamed Business'}`);
      console.log(`   ID: ${business.id}`);
      console.log(`   Subdomain: ${business.subdomain || 'None'}`);
      console.log(`   Industry: ${business.industry || 'Not specified'}`);
      console.log(`   Created: ${new Date(business.created_at).toLocaleDateString()}`);
      
      // Check if it has products
      if (business.products && business.products.length > 0) {
        console.log(`   Products: ${business.products.length} products found`);
        business.products.slice(0, 3).forEach((product, pIndex) => {
          console.log(`     - ${product.name} ($${product.price})`);
        });
        if (business.products.length > 3) {
          console.log(`     ... and ${business.products.length - 3} more`);
        }
      } else {
        console.log(`   Products: No products found`);
      }
      console.log('');
    });
    
    // Show the most recent business for easy copying
    if (businesses.length > 0) {
      const latestBusiness = businesses[0];
      console.log('🎯 Most recent business for image generation:');
      console.log(`   Business ID: ${latestBusiness.id}`);
      console.log(`   Name: ${latestBusiness.name}`);
      console.log(`   URL: http://localhost:3000/sites/${latestBusiness.subdomain}`);
      
      if (latestBusiness.products && latestBusiness.products.length > 0) {
        console.log(`   Ready for image generation: ${latestBusiness.products.length} products`);
      } else {
        console.log('   ⚠️ No products found - images cannot be generated');
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding businesses:', error);
  }
}

findAllBusinesses();
