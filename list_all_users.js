const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, plan')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total users: ${data.length}`);
  data.forEach(u => console.log(JSON.stringify(u)));
}

listUsers();
