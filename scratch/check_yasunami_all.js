const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllLogs() {
  const userId = '039c12e6-6a44-4d36-b614-74c357a184e9'
  
  const { data: logs, error } = await supabase
    .from('lifestyle_logs')
    .select('date, weight, water, steps, sleep, alcohol, notes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error(error)
    return
  }

  console.log('Latest 10 logs for Yasunami-san:')
  console.table(logs)
}

checkAllLogs()
