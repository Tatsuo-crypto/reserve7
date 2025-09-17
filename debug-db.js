const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  try {
    console.log('Checking users table structure...')
    
    // Check if plan column exists
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, plan, status')
      .limit(3)
    
    if (error) {
      console.error('Error querying users:', error)
      return
    }
    
    console.log('Sample users data:')
    console.table(users)
    
    // Check if any user has plan data
    const usersWithPlan = users.filter(u => u.plan)
    console.log(`\nUsers with plan data: ${usersWithPlan.length}/${users.length}`)
    
    if (usersWithPlan.length === 0) {
      console.log('\n⚠️  No users have plan data. Need to add plan column or update existing users.')
    }
    
  } catch (error) {
    console.error('Database check failed:', error)
  }
}

checkDatabase()
