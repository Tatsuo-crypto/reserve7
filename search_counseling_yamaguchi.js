const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findCounselingYamaguchi() {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, title, notes, client_id')
    .or('title.ilike.%カウンセリング%,notes.ilike.%カウンセリング%')
    .or('title.ilike.%山口%,notes.ilike.%山口%');

  console.log('Counseling/Yamaguchi results count:', data.length);
  data.filter(r => r.title.includes('山口') || r.notes?.includes('山口')).forEach(r => console.log(JSON.stringify(r)));
}

findCounselingYamaguchi();
