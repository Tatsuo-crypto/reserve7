const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const STORE_1_ID = '77439c86-679a-409a-8000-2e5297e5c0e8'

async function run() {
    console.log('Checking Store 1 Users...')

    // 1. Get all users for Store 1
    const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, email, plan, status')
        .eq('store_id', STORE_1_ID)
        .eq('status', 'active') // Only check active users

    if (error) {
        console.error(error)
        return
    }

    console.log(`Total Active Users in 'users' table for Store 1: ${users.length}`)

    // 2. Check Membership History for each
    const { data: history } = await supabase
        .from('membership_history')
        .select('user_id, status, start_date, end_date')
        .eq('store_id', STORE_1_ID)
        .eq('status', 'active')

    const historyUserIds = new Set(history.map(h => h.user_id))

    const usersMissingHistory = users.filter(u => !historyUserIds.has(u.id))

    console.log(`Users missing active membership_history: ${usersMissingHistory.length}`)
    if (usersMissingHistory.length > 0) {
        console.table(usersMissingHistory)
    }

    // 3. Check Sales for each
    // We need recent sales for projected sales calculation
    const { data: sales } = await supabase
        .from('sales')
        .select('user_id, amount')
        .eq('store_id', STORE_1_ID)
        .eq('type', 'monthly_fee')
        .gte('target_date', '2025-07-01') // Recent enough

    const salesUserIds = new Set(sales.map(s => s.user_id))
    const usersMissingSales = users.filter(u => !salesUserIds.has(u.id))

    console.log(`Users missing recent sales: ${usersMissingSales.length}`)
    if (usersMissingSales.length > 0) {
        console.table(usersMissingSales)
    }
}

run()
