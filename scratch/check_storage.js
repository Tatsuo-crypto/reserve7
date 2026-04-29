const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStorage() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }
  console.log('Buckets:', buckets.map(b => b.name));
  
  const exists = buckets.find(b => b.name === 'diet-images');
  if (!exists) {
    console.log('diet-images bucket does not exist. Creating...');
    const { data, error: createError } = await supabaseAdmin.storage.createBucket('diet-images', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      fileSizeLimit: 5242880
    });
    if (createError) {
      console.error('Error creating bucket:', createError);
    } else {
      console.log('Bucket created successfully:', data);
    }
  } else {
    console.log('diet-images bucket exists.');
  }
}

checkStorage();
