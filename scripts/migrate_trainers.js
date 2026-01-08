const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log('Starting migration: Add google_calendar_id to trainers table...');

  try {
    // Check if column exists
    const { data: trainers, error: fetchError } = await supabase
      .from('trainers')
      .select('google_calendar_id')
      .limit(1);

    if (!fetchError) {
      console.log('Column google_calendar_id already exists.');
      return;
    }

    // If error, assume column might strictly not exist (or other error)
    // Since we can't run raw SQL easily with JS client without a specific function or RPC,
    // we might need to rely on the user running the SQL file or use a workaround if the user has a 'exec_sql' RPC.
    // However, looking at previous context, there is 'src/app/api/admin/generate-sql/route.ts', maybe I can use that logic?
    // No, standard supabase-js client doesn't support raw SQL unless RPC is set up.
    
    console.log('Cannot run raw SQL directly via client. Please execute the following SQL in your Supabase dashboard:');
    console.log(`
      ALTER TABLE trainers ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_trainers_google_calendar_id ON trainers(google_calendar_id);
    `);
    
    // Attempt to use a common rpc name if it exists, otherwise just warn
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE trainers ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;'
    });

    if (rpcError) {
      console.log('Attempted RPC exec_sql but failed (expected if not configured):', rpcError.message);
    } else {
      console.log('Migration executed via RPC!');
    }

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
