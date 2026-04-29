const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function searchYukari() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, title, notes, client_id')
    .or('title.ilike.%由香里%,notes.ilike.%由香里%');

  console.log('Results for "由香里":', data.length);
  data.forEach(r => console.log(JSON.stringify(r)));
}

searchYukari();
