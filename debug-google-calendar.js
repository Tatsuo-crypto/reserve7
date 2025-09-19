const { createClient } = require('@supabase/supabase-js')

// Environment variables check
console.log('=== Google Calendar Environment Variables Check ===')
console.log('GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
console.log('GOOGLE_CALENDAR_ID_1:', process.env.GOOGLE_CALENDAR_ID_1)
console.log('GOOGLE_CALENDAR_ID_2:', process.env.GOOGLE_CALENDAR_ID_2)

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    console.log('Service Account Email:', credentials.client_email)
    console.log('Project ID:', credentials.project_id)
    console.log('Private Key exists:', !!credentials.private_key)
  } catch (error) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', error.message)
  }
} else {
  console.log('❌ GOOGLE_SERVICE_ACCOUNT_KEY is not set')
}

// Check recent reservations for calendar sync status
async function checkRecentReservations() {
  console.log('\n=== Recent Reservations Calendar Sync Status ===')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, title, external_event_id, calendar_id, created_at, date, start_time')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Failed to fetch reservations:', error)
    return
  }

  console.log(`Found ${reservations.length} recent reservations:`)
  reservations.forEach(reservation => {
    console.log(`- ${reservation.title} (${reservation.date} ${reservation.start_time})`)
    console.log(`  Calendar Event ID: ${reservation.external_event_id || 'None'}`)
    console.log(`  Calendar ID: ${reservation.calendar_id || 'None'}`)
    console.log(`  Created: ${reservation.created_at}`)
    console.log('')
  })

  const syncedCount = reservations.filter(r => r.external_event_id).length
  const totalCount = reservations.length
  
  console.log(`Calendar Sync Status: ${syncedCount}/${totalCount} reservations synced`)
  
  if (syncedCount === 0 && totalCount > 0) {
    console.log('❌ No reservations are synced with Google Calendar')
  } else if (syncedCount < totalCount) {
    console.log('⚠️  Some reservations are not synced with Google Calendar')
  } else if (syncedCount === totalCount && totalCount > 0) {
    console.log('✅ All recent reservations are synced with Google Calendar')
  }
}

checkRecentReservations().catch(console.error)
