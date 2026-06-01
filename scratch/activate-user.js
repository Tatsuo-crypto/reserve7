const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // Update member '牛木 麻梨奈' to active status and set a test email
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'active',
      email: 'test-ushiki@example.com'
    })
    .eq('id', '1ab2c3af-0ad1-4886-8700-75e1e672c279')
    .select();

  if (error) {
    console.error('Error updating user:', error);
    return;
  }

  console.log('Successfully updated user to active status:', data);
}

run();
