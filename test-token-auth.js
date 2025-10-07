// Test script to check if access_token exists in database
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testTokenAuth() {
  console.log('Testing access_token in database...\n')

  // Get all non-admin users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, access_token')
    .neq('email', 'tandjgym@gmail.com')
    .neq('email', 'tandjgym2goutenn@gmail.com')
    .limit(5)

  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  console.log(`Found ${users.length} users:`)
  users.forEach(user => {
    console.log(`- ${user.full_name} (${user.email})`)
    console.log(`  access_token: ${user.access_token ? '✅ ' + user.access_token : '❌ NOT SET'}`)
    if (user.access_token) {
      console.log(`  URL: http://localhost:3000/client/${user.access_token}`)
    }
    console.log()
  })

  // Test token auth API with first user
  if (users.length > 0 && users[0].access_token) {
    console.log('\nTesting token auth API...')
    const testUrl = `http://localhost:3000/api/auth/token?token=${users[0].access_token}`
    console.log(`URL: ${testUrl}`)
    
    try {
      const response = await fetch(testUrl)
      const data = await response.json()
      console.log('Response:', JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('Fetch error:', err.message)
    }
  }
}

testTokenAuth()
