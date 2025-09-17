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

async function testLogin() {
  try {
    console.log('Testing login functionality...')
    console.log('Supabase URL:', supabaseUrl)
    
    // Test user credentials
    const testEmail = 'tandjgym@gmail.com'
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail.toLowerCase())
      .single()

    if (error) {
      console.error('Database error:', error)
      return
    }

    console.log('User found:', {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      status: user.status,
      plan: user.plan
    })

    // Test NextAuth secret
    console.log('NextAuth Secret exists:', !!process.env.NEXTAUTH_SECRET)
    console.log('NextAuth URL:', process.env.NEXTAUTH_URL)
    
  } catch (error) {
    console.error('Login test failed:', error)
  }
}

testLogin()
