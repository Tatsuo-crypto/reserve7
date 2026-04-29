const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateStorage() {
  console.log('Updating diet-images bucket configuration...');
  const { data, error } = await supabaseAdmin.storage.updateBucket('diet-images', {
    public: true,
    fileSizeLimit: 10485760 // 10MB
  });
  
  if (error) {
    console.error('Error updating bucket:', error);
  } else {
    console.log('Bucket updated successfully:', data);
  }
}

updateStorage();
