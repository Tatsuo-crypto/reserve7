require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function checkSchema() {
  console.log('Checking sales table schema...\n')
  
  // Try to select with memo and status columns
  const { data, error } = await supabase
    .from('sales')
    .select('id, user_id, amount, type, status, memo, created_at')
    .limit(1)
  
  if (error) {
    console.error('❌ Error querying sales table:', error.message)
    console.error('\nThis means the columns have not been added yet.')
    console.error('Please run this SQL in Supabase Dashboard > SQL Editor:')
    console.error('\nALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text DEFAULT \'unpaid\';')
    console.error('ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS memo text;')
  } else {
    console.log('✅ Sales table columns are available!')
    console.log('Schema includes: id, user_id, amount, type, status, memo, created_at')
    if (data && data.length > 0) {
      console.log('\nSample row:', data[0])
    } else {
      console.log('\n(No data in table yet)')
    }
  }
}

checkSchema()
