const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, store_id')
    .eq('role', 'ADMIN');

  if (error) {
    console.error('Error fetching admins:', error);
    return;
  }

  console.log('--- ADMIN USERS ---');
  console.log(admins);
}

run();
