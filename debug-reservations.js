const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkReservationsTable() {
  try {
    console.log('Checking reservations table structure...')
    
    // Get table info
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .limit(3)
    
    if (error) {
      console.error('Error querying reservations:', error)
      return
    }
    
    console.log('Sample reservations data:')
    console.table(reservations)
    
    if (reservations.length > 0) {
      console.log('\nReservation table columns:')
      console.log(Object.keys(reservations[0]))
    }
    
  } catch (error) {
    console.error('Reservations check failed:', error)
  }
}

checkReservationsTable()
