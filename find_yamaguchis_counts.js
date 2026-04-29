const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findYamaguchis() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, plan')
    .or('full_name.ilike.山口%,full_name.ilike.% 山口%,full_name.ilike.%　山口%');

  console.log('Users:', data);

  for (const u of data) {
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', u.id);
    console.log(`User ${u.full_name} has ${count} reservations`);
  }
}

findYamaguchis();
