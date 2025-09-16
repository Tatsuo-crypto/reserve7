const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUser() {
  try {
    console.log('Checking user: tandjgym@gmail.com')
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tandjgym@gmail.com')
      .single()

    if (error) {
      console.error('Database error:', error)
      return
    }

    if (!user) {
      console.log('User not found in database')
      return
    }

    console.log('User found:')
    console.log('- ID:', user.id)
    console.log('- Email:', user.email)
    console.log('- Full Name:', user.full_name)
    console.log('- Store ID:', user.store_id)
    console.log('- Created At:', user.created_at)
    console.log('- Password Hash exists:', !!user.password_hash)
    console.log('- Password Hash length:', user.password_hash?.length)

    // Test password verification
    const testPassword = '30tandjgym30'
    const isValidPassword = await bcrypt.compare(testPassword, user.password_hash)
    console.log('- Password "30tandjgym30" is valid:', isValidPassword)

    // Test with other common passwords
    const commonPasswords = ['password', 'admin', 'tandjgym', '123456']
    for (const pwd of commonPasswords) {
      const isValid = await bcrypt.compare(pwd, user.password_hash)
      if (isValid) {
        console.log(`- Password "${pwd}" is valid: true`)
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

checkUser()
