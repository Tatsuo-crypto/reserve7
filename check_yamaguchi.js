const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkYamaguchi() {
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, full_name, plan')
    .or('full_name.ilike.%山口%');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No user found with name 山口');
    return;
  }

  for (const user of users) {
    console.log(`User: ${user.full_name} (ID: ${user.id}), Plan: ${user.plan}`);
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, start_time, title')
      .eq('client_id', user.id)
      .order('start_time', { ascending: true });

    if (resError) {
      console.error(`Error fetching reservations for ${user.full_name}:`, resError);
      continue;
    }

    console.log(`Found ${reservations.length} reservations:`);
    reservations.forEach((r, i) => {
      console.log(`${i + 1}: ${r.start_time} - Title: ${r.title}`);
    });
  }
}

checkYamaguchi();
