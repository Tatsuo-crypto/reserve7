const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getSample() {
  const { data, error } = await supabase
    .from('reservations')
    .select('calendar_id, trainer_id, client_id')
    .eq('client_id', '4b50a6c9-b4e7-450a-a3a9-f8adae6bdb8b')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample Reservation for Yamaguchi:', data);
}

getSample();
