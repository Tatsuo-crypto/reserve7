const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkBlockedTimesTable() {
  try {
    console.log('Checking if blocked_times table exists...')
    
    // Try to query the table
    const { data, error } = await supabase
      .from('blocked_times')
      .select('count(*)')
      .limit(1)

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('❌ blocked_times table does NOT exist')
        console.log('\nTo create the table, run this SQL in Supabase Dashboard:')
        console.log('https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/sql')
        console.log('\n--- SQL to run ---')
        console.log(`
-- Create blocked_times table
CREATE TABLE blocked_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'tandjgym@gmail.com',
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly')),
    recurrence_end DATE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_blocked_times_calendar_id ON blocked_times(calendar_id);
CREATE INDEX idx_blocked_times_start_time ON blocked_times(start_time);

-- Add constraints
ALTER TABLE blocked_times ADD CONSTRAINT check_end_after_start 
    CHECK (end_time > start_time);

-- Enable RLS
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin access to blocked_times" ON blocked_times
    FOR ALL USING (true);
        `)
        return false
      } else {
        console.error('Error checking table:', error)
        return false
      }
    }

    console.log('✅ blocked_times table exists!')
    console.log('Current records:', data)
    return true

  } catch (error) {
    console.error('Error:', error)
    return false
  }
}

checkBlockedTimesTable()
