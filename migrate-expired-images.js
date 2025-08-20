const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function ensureStorageBucket() {
  try {
    console.log('🪣 Checking product-images storage bucket...');
    
    // Try to get the bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucket = buckets.find(b => b.id === 'product-images');
    
    if (!bucket) {
      console.log('📁 Creating product-images bucket...');
      
      const { data, error } = await supabase.storage.createBucket('product-images', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      });
      
      if (error) {
        console.error('❌ Error creating bucket:', error);
        return false;
      }
      
      console.log('✅ Storage bucket created successfully');
    } else {
      console.log('✅ Storage bucket already exists');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error with storage bucket:', error);
    return false;
  }
}

async function migrateExpiredImagesForBusiness() {
  const businessId = '54c0ec82-d17b-41b2-9442-0163a3b7b9a4'; // ModernMan Skin Co.
  
  try {
    console.log('🔄 Migrating expired images for ModernMan Skin Co...\n');
    
    // Ensure storage bucket exists
    const bucketReady = await ensureStorageBucket();
    if (!bucketReady) {
      console.log('⚠️  Warning: Storage bucket not ready, images may still be temporary');
    }
    
    console.log('\n📸 Starting image migration...');
    
    const response = await fetch('http://localhost:3000/api/generate/product-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        migrateExpired: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`📸 Migrated ${result.migratedCount} products with new permanent images`);
      console.log('\n🌐 Your store should now display images correctly:');
      console.log('   → http://localhost:3000/sites/modernmanskinco');
      console.log('\n💡 Images are now stored permanently and won\'t expire!');
    } else {
      console.log('ℹ️  Migration result:', result.message);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure your development server is running: npm run dev');
      console.log('2. Ensure OpenAI API key is configured in environment variables');
      console.log('3. Check that Supabase is configured correctly');
    }
  }
}

migrateExpiredImagesForBusiness();
