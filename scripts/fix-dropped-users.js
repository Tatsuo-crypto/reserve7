const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Fixing Dropped Users (Resetting to Active)...')

    // 1. Identify "False Withdrawal" candidates
    // Look for active records ending on 2026-01-04
    const { data: activeClosing } = await supabase
        .from('membership_history')
        .select('id, user_id, start_date')
        .eq('status', 'active')
        .eq('end_date', '2026-01-04')

    console.log(`Found ${activeClosing.length} active records closed today.`)

    const userIds = activeClosing.map(h => h.user_id)

    if (userIds.length === 0) {
        console.log('No records to fix.')
        return
    }

    // 2. Delete 'withdrawn' records for these users starting 2026-01-04
    const { error: deleteError } = await supabase
        .from('membership_history')
        .delete()
        .in('user_id', userIds)
        .eq('status', 'withdrawn')
        .eq('start_date', '2026-01-04')

    if (deleteError) {
        console.error('Error deleting withdrawn records:', deleteError)
        return
    }
    console.log('Deleted corresponding withdrawn records.')

    // 3. Update active records to have end_date = NULL
    const { error: updateError } = await supabase
        .from('membership_history')
        .update({ end_date: null })
        .in('id', activeClosing.map(h => h.id))

    if (updateError) {
        console.error('Error updating active records:', updateError)
        return
    }
    console.log('Updated active records to be open-ended.')

    // 4. Ensure Users table status is 'active'
    const { error: userError } = await supabase
        .from('users')
        .update({ status: 'active' })
        .in('id', userIds)

    if (userError) {
        console.error('Error updating users table:', userError)
    } else {
        console.log('Ensure users table status is active.')
    }
}

run()
