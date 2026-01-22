const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const STORE_1_ID = '77439c86-679a-409a-8000-2e5297e5c0e8'

const USERS_TO_FIX = [
    { id: '1121a35f-1ee0-4b3f-91d7-0a7b4f54b587', name: '谷 智代', amount: 0 },
    { id: '6a00361f-bf57-4502-848b-ed58848b8e9c', name: '山口 由加里', amount: 0 },
    { id: '1dfd208f-9017-4246-b36b-28f485abec32', name: '山崎 ジジオ千春', amount: 6380 },
    { id: '47b83031-7564-4b9e-8518-bab06a90b389', name: '陳 冠元', amount: 6380 },
    { id: '9d3bad92-c8e8-47b7-80c5-fdaf987bcdc9', name: '浅山 扇代', amount: 0 }
]

async function run() {
    console.log('Fixing Analytics Mismatch...')

    // 1. Insert Membership History
    for (const u of USERS_TO_FIX) {
        console.log(`Processing ${u.name}...`)

        // Check if history exists
        const { data: existing } = await supabase
            .from('membership_history')
            .select('*')
            .eq('user_id', u.id)
            .eq('status', 'active')

        if (!existing || existing.length === 0) {
            console.log(`  Inserting membership_history for ${u.name}`)
            const { error } = await supabase.from('membership_history').insert({
                user_id: u.id,
                store_id: STORE_1_ID,
                status: 'active',
                start_date: '2025-01-01', // Start of this year/month
                end_date: null
            })
            if (error) console.error('  Error inserting history:', error)
        } else {
            console.log(`  History already exists for ${u.name}`)
        }

        // 2. Insert Sales
        if (u.amount > 0) {
            // Check if sale exists (approx matching)
            const { data: sales } = await supabase
                .from('sales')
                .select('*')
                .eq('user_id', u.id)
                .eq('type', 'monthly_fee')
                .gte('target_date', '2025-01-01') // Recent

            if (!sales || sales.length === 0) {
                console.log(`  Inserting sales for ${u.name}: ¥${u.amount}`)
                const { error } = await supabase.from('sales').insert({
                    user_id: u.id,
                    store_id: STORE_1_ID,
                    amount: u.amount,
                    type: 'monthly_fee',
                    target_date: '2025-01-01',
                    payment_date: new Date().toISOString()
                })
                if (error) console.error('  Error inserting sale:', error)
            } else {
                console.log(`  Sales already exist for ${u.name}`)
            }
        }
    }

    console.log('Done.')
}

run()
