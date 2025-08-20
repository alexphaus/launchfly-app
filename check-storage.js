const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkStorageSetup() {
  try {
    console.log('🔍 Checking Supabase Storage setup...\n');
    
    // List all buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }
    
    console.log('📦 Available Storage Buckets:');
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.id} (${bucket.public ? 'Public' : 'Private'})`);
    });
    
    // Check if product-images bucket exists
    const productImagesBucket = buckets.find(b => b.id === 'product-images');
    
    if (productImagesBucket) {
      console.log('\n✅ product-images bucket exists!');
      console.log('   Settings:', {
        public: productImagesBucket.public,
        fileSizeLimit: productImagesBucket.file_size_limit,
        allowedMimeTypes: productImagesBucket.allowed_mime_types
      });
      
      // Check how many images are stored
      const { data: files, error: filesError } = await supabase.storage
        .from('product-images')
        .list('54c0ec82-d17b-41b2-9442-0163a3b7b9a4', { limit: 10 });
      
      if (!filesError && files) {
        console.log(`\n📸 Found ${files.length} stored images for ModernMan Skin Co.`);
        if (files.length > 0) {
          console.log('   Sample images:');
          files.slice(0, 3).forEach(file => {
            console.log(`   - ${file.name} (${Math.round(file.metadata.size / 1024)}KB)`);
          });
        }
      }
    } else {
      console.log('\n❌ product-images bucket does NOT exist');
      console.log('   Migration needed!');
    }
    
  } catch (error) {
    console.error('❌ Error checking storage:', error);
  }
}

checkStorageSetup();
