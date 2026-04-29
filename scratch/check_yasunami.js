const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function findUserAndLogs() {
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email')
    .ilike('full_name', '%安並%')

  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  if (users.length === 0) {
    console.log('No user found with name like 安並')
    return
  }

  const user = users[0]
  console.log(`Found user: ${user.full_name} (ID: ${user.id})`)

  const { data: logs, error: logError } = await supabase
    .from('lifestyle_logs')
    .select('date, weight')
    .eq('user_id', user.id)
    .not('weight', 'is', null)
    .order('date', { ascending: false })
    .limit(5)

  if (logError) {
    console.error('Error fetching logs:', logError)
    return
  }

  console.log('\nLatest weight logs:')
  console.table(logs)
}

findUserAndLogs()
