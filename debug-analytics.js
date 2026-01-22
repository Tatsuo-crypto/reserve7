const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    // 1. Get Stores
    const { data: stores } = await supabase.from('stores').select('id, name')
    console.log('Stores:', stores)

    // 2. For each store, calculate active users and sales
    for (const store of stores || []) {
        console.log(`\nAnalyzing Store: ${store.name} (${store.id})`)

        // Fetch active membership history
        const today = new Date()
        const { data: history } = await supabase
            .from('membership_history')
            .select('*')
            .eq('store_id', store.id)
            .eq('status', 'active')

        // Filter for current active
        const activeHistory = (history || []).filter(h => {
            const start = new Date(h.start_date)
            const end = h.end_date ? new Date(h.end_date) : null
            return (!end || end > today)
        })

        console.log(`Active Members Count (from membership_history): ${activeHistory.length}`)

        // Get their User IDs
        const activeUserIds = activeHistory.map(h => h.user_id)

        // Fetch latest sales for these users
        let totalSales = 0
        if (activeUserIds.length > 0) {
            const { data: sales } = await supabase
                .from('sales')
                .select('user_id, amount, payment_date')
                .eq('type', 'monthly_fee')
                .in('user_id', activeUserIds)
                .order('payment_date', { ascending: false })

            // Map latest sale per user
            const userLatestSale = new Map()
            sales.forEach(s => {
                if (!userLatestSale.has(s.user_id)) {
                    userLatestSale.set(s.user_id, s.amount)
                }
            })

            activeUserIds.forEach(uid => {
                const amount = userLatestSale.get(uid)
                if (amount) {
                    totalSales += amount
                } else {
                    console.log(`  Warning: No monthly_fee sale found for active user ${uid}`)
                }
            })
        }

        console.log(`Projected Sales (Sum of latest monthly_fee): ${totalSales}`)
    }
}

run()
