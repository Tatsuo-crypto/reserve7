const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findTrialYamaguchi() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, title, notes')
    .ilike('title', '%体験%')
    .ilike('title', '%山口%');

  console.log('Search 1 (Title include 体験 and 山口):', data);

  const { data: data2, error: error2 } = await supabase
    .from('reservations')
    .select('id, start_time, title, notes')
    .ilike('title', '%体験%')
    .or('notes.ilike.%山口%,title.ilike.%山口%');

  console.log('Search 2 (Title include 体験, and Title/Notes include 山口):', data2);
}

findTrialYamaguchi();
