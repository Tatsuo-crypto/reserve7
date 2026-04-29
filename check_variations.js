const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkVariations() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, plan')
    .or('full_name.ilike.%山口%,full_name.ilike.%やまぐち%,full_name.ilike.%yamaguchi%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${users.length} user variations:`);
  users.forEach(u => console.log(JSON.stringify(u)));

  const { data: res, error: resError } = await supabase
    .from('reservations')
    .select('id, start_time, title, client_id')
    .or('title.ilike.%山口%,title.ilike.%やまぐち%,title.ilike.%yamaguchi%')
    .order('start_time', { ascending: true });

  if (resError) {
    console.error('Error:', resError);
    return;
  }

  console.log(`Found ${res.length} reservation variations:`);
  res.forEach((r, i) => {
    console.log(`${i + 1}: ${r.start_time} - Title: ${r.title} - ClientID: ${r.client_id}`);
  });
}

checkVariations();
