const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const STORE_1_ID = '77439c86-679a-409a-8000-2e5297e5c0e8'

async function run() {
    console.log('Analyzing Store 1 Existing 13 Users...')

    // Get active history
    const today = new Date()
    const { data: history } = await supabase
        .from('membership_history')
        .select('user_id, status, start_date, end_date')
        .eq('store_id', STORE_1_ID)
        .eq('status', 'active')

    const activeHistory = history.filter(h => {
        const start = new Date(h.start_date)
        const end = h.end_date ? new Date(h.end_date) : null
        return (!end || end > today)
    })

    console.log(`Active Members: ${activeHistory.length}`)
    const activeUserIds = activeHistory.map(h => h.user_id)

    const { data: users } = await supabase
        .from('users')
        .select('id, full_name, plan')
        .in('id', activeUserIds)

    // Get Sales
    const { data: sales } = await supabase
        .from('sales')
        .select('user_id, amount, payment_date')
        .eq('type', 'monthly_fee')
        .in('user_id', activeUserIds)
        .order('payment_date', { ascending: false })

    const userSaleMap = new Map()
    sales.forEach(s => {
        if (!userSaleMap.has(s.user_id)) {
            userSaleMap.set(s.user_id, s.amount)
        }
    })

    let total = 0
    console.log('Individual Contributions:')
    users.forEach(u => {
        const amount = userSaleMap.get(u.id) || 0
        total += amount
        console.log(`- ${u.full_name} (${u.plan}): ¥${amount.toLocaleString()}`)
    })
    console.log(`Total: ¥${total.toLocaleString()}`)
}

run()
