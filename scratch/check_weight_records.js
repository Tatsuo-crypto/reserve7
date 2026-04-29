const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkWeightRecords() {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .limit(1)

  if (error) {
    console.error(error)
    return
  }

  if (data.length > 0) {
    console.log('Columns in weight_records:', Object.keys(data[0]))
  } else {
    console.log('No data in weight_records')
  }
}

checkWeightRecords()
