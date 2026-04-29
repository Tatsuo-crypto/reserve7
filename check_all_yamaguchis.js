const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, plan')
    .ilike('full_name', '%山口%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} users with "山口" in name:`);
  data.forEach(u => console.log(JSON.stringify(u)));
}

checkAllUsers();
