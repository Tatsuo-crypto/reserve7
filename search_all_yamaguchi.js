const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function searchAllYamaguchi() {
  const { data: res, error } = await supabase
    .from('reservations')
    .select('id, start_time, title, client_id')
    .or('title.ilike.%山口%')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${res.length} reservations with "山口" in title:`);
  res.forEach((r, i) => {
    console.log(`${i + 1}: ${r.start_time} - Title: ${r.title} - ClientID: ${r.client_id}`);
  });
}

searchAllYamaguchi();
