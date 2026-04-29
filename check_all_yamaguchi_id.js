const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllForClient() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, title')
    .eq('client_id', '4b50a6c9-b4e7-450a-a3a9-f8adae6bdb8b')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} reservations for client 4b50a6c9... (山口):`);
  data.forEach((r, i) => {
    console.log(`${i + 1}: ${r.start_time} - Title: ${r.title}`);
  });
}

checkAllForClient();
