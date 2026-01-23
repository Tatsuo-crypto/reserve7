require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addColumns() {
  console.log('Adding status and memo columns to sales table...')
  
  // Add status column
  const { error: statusError } = await supabase.rpc('exec_sql', {
    query: `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid'));`
  })
  
  if (statusError) {
    console.error('Error adding status column:', statusError)
  } else {
    console.log('✓ Status column added')
  }
  
  // Add memo column
  const { error: memoError } = await supabase.rpc('exec_sql', {
    query: `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS memo text;`
  })
  
  if (memoError) {
    console.error('Error adding memo column:', memoError)
  } else {
    console.log('✓ Memo column added')
  }
  
  console.log('\nDone! Please refresh your browser.')
}

addColumns()
