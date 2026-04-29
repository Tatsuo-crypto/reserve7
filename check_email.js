const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEmail() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .ilike('email', '%yukari.6823%');

  console.log('Users by email:', users);

  const { data: res, error: resError } = await supabase
    .from('reservations')
    .select('id, start_time, title, client_id, notes')
    .or('notes.ilike.%yukari.6823%,title.ilike.%yukari.6823%');

  console.log('Reservations by email search:', res.length);
  res.forEach(r => console.log(JSON.stringify(r)));
}

checkEmail();
