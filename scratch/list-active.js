const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, status, store_id')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching active users:', error);
    return;
  }

  console.log('--- ACTIVE USERS IN DB ---');
  console.log(users);
}

run();
