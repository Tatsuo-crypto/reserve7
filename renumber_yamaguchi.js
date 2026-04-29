const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CLIENT_ID = '4b50a6c9-b4e7-450a-a3a9-f8adae6bdb8b';

async function updateTitles() {
  console.log('Fetching all reservations for Yamaguchi...');
  const { data: res, error } = await supabase
    .from('reservations')
    .select('id, start_time, title')
    .eq('client_id', CLIENT_ID)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${res.length} reservations. Re-numbering...`);

  for (let i = 0; i < res.length; i++) {
    const newTitle = `山口${i + 1}`;
    if (res[i].title !== newTitle) {
      console.log(`Updating session on ${res[i].start_time} to ${newTitle}`);
      const { error: updError } = await supabase
        .from('reservations')
        .update({ title: newTitle })
        .eq('id', res[i].id);

      if (updError) {
        console.error(`Error updating session ${i + 1}:`, updError);
      }
    }
  }

  console.log('Done.');
}

updateTitles();
