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
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, status, store_id');

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log('--- ALL USERS ---');
  console.log(users);
  
  const { data: stores } = await supabase.from('stores').select('*');
  console.log('--- ALL STORES ---');
  console.log(stores);
}

run();
