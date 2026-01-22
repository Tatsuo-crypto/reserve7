const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const { addMonths, startOfMonth, format, isBefore, isAfter } = require('date-fns')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

const DUMMY_HASH = '$2a$10$pxRGAx96PscTf1.C9/qPbu0An56WvXAnv35UuA5SAnAnAnAnAnAnA'

const STORES = {
    '1号店': '77439c86-679a-409a-8000-2e5297e5c0e8',
    '2号店': '43296d78-13f3-4061-8d75-d38dfe907a5d'
}

const VALID_PLANS = [
    '月2回', '月4回', '月6回', '月8回',
    'ダイエットコース', 'ダイエットコース【2ヶ月】', 'ダイエットコース【3ヶ月】', 'ダイエットコース【6ヶ月】',
    'カウンセリング', '都度'
]

function normalizePlan(planName) {
    if (!planName) return '都度'
    for (const valid of VALID_PLANS) {
        if (planName.includes(valid)) return valid
    }
    if (planName.includes('月4')) return '月4回'
    if (planName.includes('月8')) return '月8回'
    if (planName.includes('月6')) return '月6回'
    if (planName.includes('月2')) return '月2回'
    if (planName.includes('体験') || planName.includes('カウンセリング')) return 'カウンセリング'
    return '都度'
}

function parseCSV(text) {
    const result = []
    let row = []
    let inQuote = false
    let currentToken = ''
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const nextChar = text[i + 1]
        if (inQuote) {
            if (char === '"') {
                if (nextChar === '"') { currentToken += '"'; i++ }
                else { inQuote = false }
            } else { currentToken += char }
        } else {
            if (char === '"') { inQuote = true }
            else if (char === ',') { row.push(currentToken); currentToken = '' }
            else if (char === '\n' || char === '\r') {
                if (currentToken || row.length > 0) row.push(currentToken)
                if (row.length > 0) result.push(row)
                row = []; currentToken = ''
                if (char === '\r' && nextChar === '\n') i++
            } else { currentToken += char }
        }
    }
    if (currentToken || row.length > 0) { row.push(currentToken); result.push(row) }
    return result
}

const cleanName = (s) => (s || '').replace(/[\s\u3000]/g, '').replace(/[﨑]/g, '崎').replace(/[髙]/g, '高')

async function run() {
    try {
        console.log('Final Data Import: Using split CSV files...')

        const inStockPath = path.join(process.cwd(), 'data', 'シート1-在籍.csv')
        const withdrawnPath = path.join(process.cwd(), 'data', 'シート1-退会.csv')

        const inStockData = parseCSV(fs.readFileSync(inStockPath, 'utf-8')).slice(1)
        const withdrawnData = parseCSV(fs.readFileSync(withdrawnPath, 'utf-8')).slice(1)

        // 1. Fetch current DB users
        const { data: dbUsers } = await supabaseAdmin.from('users').select('*')

        console.log('Resetting history and sales...')
        await supabaseAdmin.from('membership_history').delete().neq('status', 'ignore_all')
        await supabaseAdmin.from('sales').delete().neq('amount', -1)

        const today = new Date()
        const userRowsMap = new Map() // All rows per user

        // Combine all data to process per user
        for (const row of [...inStockData, ...withdrawnData]) {
            const name = row[1]
            if (!name) continue
            if (!userRowsMap.has(name)) userRowsMap.set(name, [])
            userRowsMap.get(name).push(row)
        }

        const stats = { restored: 0, matched: 0, updated: 0 }
        let timestamp = Date.now()

        for (const [name, rows] of userRowsMap.entries()) {
            // Find user
            let user = dbUsers.find(u => cleanName(u.full_name) === cleanName(name))
            if (!user && name.includes(' ')) {
                const parts = name.split(' ')
                const reversed = parts[parts.length - 1] + parts[0]
                user = dbUsers.find(u => cleanName(u.full_name) === cleanName(reversed))
            }

            // Restore/Create if missing
            if (!user) {
                console.log(`Creating user: ${name}`)
                const dummyEmail = `no-email-${timestamp++}@example.com`
                const { data: newUser, error: createError } = await supabaseAdmin.from('users').insert({
                    full_name: name,
                    email: dummyEmail,
                    password_hash: DUMMY_HASH,
                    role: 'member',
                    store_id: STORES[rows[0][0]] || STORES['1号店'],
                    status: 'active'
                }).select().single()

                if (createError) {
                    console.error(`Error creating ${name}:`, createError.message)
                    continue
                }
                user = newUser
                stats.restored++
            } else {
                stats.matched++
            }

            // Check if user should be 'active' (exists in "在籍" CSV)
            const isInStock = inStockData.some(r => r[1] === name)

            // Process periods (Sales & History)
            for (const row of rows) {
                const startDate = new Date(row[4])
                const endDate = row[5] ? new Date(row[5]) : null
                if (isNaN(startDate.getTime())) continue

                const plan = normalizePlan(row[2])
                const price = parseInt((row[3] || '').replace(/[¥,"]/g, ''), 10) || 0

                // History
                await supabaseAdmin.from('membership_history').insert({
                    user_id: user.id,
                    store_id: STORES[row[0]] || user.store_id,
                    status: 'active',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null
                })

                // Sales
                if (price > 0) {
                    let current = startOfMonth(startDate)
                    const endLimit = endDate ? startOfMonth(endDate) : startOfMonth(today)
                    while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
                        let paymentDate = new Date(current.getFullYear(), current.getMonth(), Math.min(startDate.getDate(), 28))
                        if (endDate && isAfter(paymentDate, endDate)) break
                        if (isAfter(paymentDate, today)) break

                        await supabaseAdmin.from('sales').insert({
                            user_id: user.id,
                            store_id: STORES[row[0]] || user.store_id,
                            amount: price,
                            type: plan === '都度' || plan === 'カウンセリング' ? 'one_time' : 'monthly_fee',
                            target_date: format(current, 'yyyy-MM-01'),
                            payment_date: format(paymentDate, 'yyyy-MM-dd')
                        })
                        current = addMonths(current, 1)
                    }
                }
            }

            // Final status update
            // Explicitly set to 'active' if in InStock CSV, else check latest period
            let finalStatus = isInStock ? 'active' : 'withdrawn'

            await supabaseAdmin.from('users').update({ status: finalStatus }).eq('id', user.id)
            stats.updated++
        }

        console.log('Import Successful.')
        console.log(JSON.stringify(stats, null, 2))
    } catch (e) { console.error(e) }
}
run()
