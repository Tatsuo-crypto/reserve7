const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CLIENT_ID = '4b50a6c9-b4e7-450a-a3a9-f8adae6bdb8b';
const CALENDAR_ID = 'tandjgym@gmail.com';

const sessions = [
  { day: 6, start: '12:00', end: '13:00' },
  { day: 11, start: '14:00', end: '15:00' },
  { day: 15, start: '09:00', end: '10:00' },
  { day: 20, start: '11:00', end: '12:00' },
  { day: 23, start: '09:00', end: '10:00' },
  { day: 27, start: '09:00', end: '10:00' },
];

async function addSessions() {
  console.log('Adding 6 sessions for Yamaguchi...');
  
  const toInsert = sessions.map(s => {
    const startStr = `2025-09-${s.day.toString().padStart(2, '0')}T${s.start}:00+09:00`;
    const endStr = `2025-09-${s.day.toString().padStart(2, '0')}T${s.end}:00+09:00`;
    return {
      client_id: CLIENT_ID,
      calendar_id: CALENDAR_ID,
      start_time: startStr,
      end_time: endStr,
      title: '山口' // Temporary, will be recalculated
    };
  });

  const { data, error } = await supabase
    .from('reservations')
    .insert(toInsert)
    .select();

  if (error) {
    console.error('Error adding sessions:', error);
    return;
  }

  console.log(`Added ${data.length} sessions.`);
}

addSessions();
