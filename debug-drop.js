const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Comparing Active Members: Dec 2025 vs Jan 2026')

    const decEnd = new Date('2025-12-31T23:59:59')
    const janEnd = new Date('2026-01-31T23:59:59')

    const { data: history } = await supabase
        .from('membership_history')
        .select('user_id, status, start_date, end_date')

    const decActive = history.filter(h => {
        if (h.status !== 'active') return false
        const start = new Date(h.start_date)
        const end = h.end_date ? new Date(h.end_date) : null
        return start <= decEnd && (!end || end > decEnd)
    })

    const janActive = history.filter(h => {
        if (h.status !== 'active') return false
        const start = new Date(h.start_date)
        const end = h.end_date ? new Date(h.end_date) : null
        return start <= janEnd && (!end || end > janEnd)
    })

    console.log(`Dec 2025 Active: ${decActive.length}`)
    console.log(`Jan 2026 Active: ${janActive.length}`)

    // Find who dropped off
    const decIds = new Set(decActive.map(h => h.user_id))
    const janIds = new Set(janActive.map(h => h.user_id))

    const dropped = [...decIds].filter(id => !janIds.has(id))
    console.log(`Dropped in Jan: ${dropped.length}`)

    if (dropped.length > 0) {
        console.log('Dropped IDs:', dropped)
        // Fetch names
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', dropped)
        console.table(users)

        // Check their history end dates
        const droppedHistory = history.filter(h => dropped.includes(h.user_id))
        console.log('Dropped History Records:')
        console.table(droppedHistory)
    }
}

run()
