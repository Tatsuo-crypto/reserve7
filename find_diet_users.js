const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findDietUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, plan')
    .ilike('plan', '%ダイエット%');

  console.log('Diet plan users:', users);

  for (const u of users) {
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', u.id);
    console.log(`User ${u.full_name} has ${count} sessions`);
  }
}

findDietUsers();
