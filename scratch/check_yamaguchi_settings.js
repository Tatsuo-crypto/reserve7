const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserSettings(userId) {
  const { data, error } = await supabase
    .from('lifestyle_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Lifestyle settings for Yamaguchi:', JSON.stringify(data, null, 2));
}

checkUserSettings('4b50a6c9-b4e7-450a-a3a9-f8adae6bdb8b');
