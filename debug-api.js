const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUserProfileAPI() {
  try {
    console.log('Testing user profile API logic...')
    
    // Simulate getting a user (using the first admin user)
    const testUserId = 'f1080089-0086-4f8c-856a-f7d179b59f40'
    
    // Get user profile information
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('plan, status')
      .eq('id', testUserId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return
    }

    console.log('User profile data:', userProfile)
    
    // Test monthly usage calculation
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    
    console.log(`Checking reservations for ${year}-${month}...`)
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00+00:00`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00+00:00`
    
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('client_id', testUserId)
      .gte('start_time', startDate)
      .lt('start_time', endDate)

    if (reservationError) {
      console.error('Reservation query error:', reservationError)
      return
    }

    console.log(`Found ${reservations.length} reservations this month`)
    console.log('Reservations:', reservations)
    
    // Calculate monthly usage
    const planName = userProfile.plan || '月4回'
    const planLimits = {
      '月2回': 2,
      '月4回': 4,
      '月6回': 6,
      '月8回': 8,
      'ダイエットコース': 8
    }
    
    const maxCount = planLimits[planName] || 4
    const currentCount = reservations.length
    
    const monthlyUsage = {
      currentCount,
      maxCount,
      planName
    }
    
    console.log('Monthly usage:', monthlyUsage)
    
    const finalResponse = {
      ...userProfile,
      monthlyUsage
    }
    
    console.log('Final API response should be:', finalResponse)
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testUserProfileAPI()
