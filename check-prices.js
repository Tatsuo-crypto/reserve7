const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    // Get recent sales for '月4回' and 'ダイエットコース' and '都度'
    const { data: sales } = await supabase
        .from('sales')
        .select('amount, type, user_id, users(plan)')
        .eq('type', 'monthly_fee')
        // .limit(20)
        .order('payment_date', { ascending: false })

    const planPrices = {}
    sales.forEach(s => {
        const plan = s.users?.plan
        if (plan) {
            if (!planPrices[plan]) planPrices[plan] = []
            planPrices[plan].push(s.amount)
        }
    })

    console.log('Typical Prices per Plan:')
    for (const [plan, prices] of Object.entries(planPrices)) {
        // Average
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length
        console.log(`  ${plan}: ${avg} (samples: ${prices.length})`)
    }
}
run()
