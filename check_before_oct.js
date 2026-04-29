const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBeforeOct() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, title, notes, client_id')
    .lt('start_time', '2025-10-01T00:00:00Z')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} reservations before Oct 1st:`);
  data.forEach(r => {
    if (JSON.stringify(r).includes('山') || JSON.stringify(r).includes('Y')) {
       console.log(JSON.stringify(r));
    }
  });
}

checkBeforeOct();
