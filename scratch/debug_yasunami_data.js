const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugData() {
  // 1. Find user by name
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email')
    .ilike('full_name', '%安並%');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  console.log('Found users:', users);

  if (users.length > 0) {
    const userId = users[0].id;
    
    // 2. Check weight_records
    const { data: weights, error: weightError } = await supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId);

    if (weightError) {
      console.error('Error fetching weights:', weightError);
    } else {
      console.log(`Weight records for ${users[0].full_name} (${userId}):`, weights);
    }

    // 3. Check all tables related to weight
    const { data: columns, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: 'weight_records' });
    
    if (colError) {
        // Fallback: list all tables
        console.log('Could not get columns, checking table list...');
    }
  }
}

debugData();
