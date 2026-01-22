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
const ADMIN_EMAILS = ['tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com']

function normalizeName(s) {
    if (!s) return '';
    return s.replace(/[\s\u3000]/g, '').replace(/[﨑]/g, '崎').replace(/[髙]/g, '高');
}

function parseCSV(text) {
    const result = []
    let row = []
    let inQuote = false
    let currentToken = ''
    for (let i = 0; i < text.length; i++) {
        const char = text[i]; const nextChar = text[i + 1]
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

async function run() {
    try {
        console.log('--- Final Refined Reconstruction (Fixing Past Sales & Emails) ---')
        const inStockData = parseCSV(fs.readFileSync(path.join(process.cwd(), 'data', 'シート1-在籍.csv'), 'utf-8')).slice(1)
        const withdrawnData = parseCSV(fs.readFileSync(path.join(process.cwd(), 'data', 'シート1-退会.csv'), 'utf-8')).slice(1)

        const personGroups = new Map()

        // 1. 在籍者を優先登録
        for (const row of inStockData) {
            const name = row[1]; if (!name) continue
            const nName = normalizeName(name)
            if (!personGroups.has(nName)) personGroups.set(nName, { originalName: name, rows: [], isActive: true, memo: row[6] || '' })
            personGroups.get(nName).rows.push(row)
            personGroups.get(nName).isActive = true
        }
        // 2. 退会者を登録（在籍していればactiveのまま）
        for (const row of withdrawnData) {
            const name = row[1]; if (!name) continue
            const nName = normalizeName(name)
            if (!personGroups.has(nName)) personGroups.set(nName, { originalName: name, rows: [], isActive: false, memo: row[6] || '' })
            personGroups.get(nName).rows.push(row)
        }

        console.log('Clearing old sales, history, and members...')
        await supabaseAdmin.from('membership_history').delete().neq('status', 'ignore_all')
        await supabaseAdmin.from('sales').delete().neq('amount', -1)

        const { data: currentUsers } = await supabaseAdmin.from('users').select('id, full_name, email')
        const memberIdsToDelete = currentUsers.filter(u => !ADMIN_EMAILS.includes(u.email)).map(u => u.id)
        if (memberIdsToDelete.length > 0) await supabaseAdmin.from('users').delete().in('id', memberIdsToDelete)

        const today = new Date()
        const stats = { users: 0, sales: 0, history: 0 }
        let memberCounter = 1

        for (const [nName, person] of personGroups.entries()) {
            // 在籍情報を優先的に採用するが、売上は全ての行から生成する
            const activeRow = person.rows.find(r => person.isActive ? true : true)
            const storeId = STORES[activeRow[0]] || STORES['1号店']

            // 会員作成 (メールアドレスは内部管理用とし、表示上は別で扱うか後で入力する形に)
            const internalEmail = `member-${memberCounter++}@gym.internal`
            const { data: user, error: userError } = await supabaseAdmin.from('users').insert({
                full_name: person.originalName,
                email: internalEmail,
                password_hash: DUMMY_HASH,
                role: 'member',
                store_id: storeId,
                status: person.isActive ? 'active' : 'withdrawn',
                plan: activeRow[2] || '都度',
                monthly_fee: parseInt((activeRow[3] || '').replace(/[¥,"]/g, ''), 10) || 0,
                memo: person.memo
            }).select().single()

            if (userError) { console.error(`Err: ${person.originalName}`, userError.message); continue }
            stats.users++

            for (const row of person.rows) {
                const rowStoreId = STORES[row[0]] || STORES['1号店']
                const rowPrice = parseInt((row[3] || '').replace(/[¥,"]/g, ''), 10) || 0
                const startDate = new Date(row[4]);
                const endDate = row[5] ? new Date(row[5]) : null
                if (isNaN(startDate.getTime())) continue

                // 履歴
                await supabaseAdmin.from('membership_history').insert({
                    user_id: user.id, store_id: rowStoreId, status: 'active',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null
                })
                stats.history++

                // 売上生成
                if (rowPrice > 0) {
                    // ダイエットプラン等で、開始日と終了日が指定されている場合は「一回限り（または指定期間のみ）」の売上とする
                    let current = startOfMonth(startDate)

                    // 終了日が指定されている場合はその月まで、指定がない場合は今日（現在月）まで売上を生成
                    const endLimit = endDate ? startOfMonth(endDate) : startOfMonth(today)

                    while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
                        let paymentDate = new Date(current.getFullYear(), current.getMonth(), Math.min(startDate.getDate(), 28))

                        // 支払い日が終了日を過ぎている場合は作成しない
                        if (endDate && isAfter(paymentDate, endDate)) break
                        // 未来の売上は作成しない
                        if (isAfter(paymentDate, today)) break

                        // 山口・谷様などの特定の過去売上は、ここで2025年の適切な月に登録される
                        await supabaseAdmin.from('sales').insert({
                            user_id: user.id,
                            store_id: rowStoreId,
                            amount: rowPrice,
                            type: (row[2].includes('都度') || row[2].includes('カウンセリング')) ? 'one_time' : 'monthly_fee',
                            target_date: format(current, 'yyyy-MM-01'),
                            payment_date: format(paymentDate, 'yyyy-MM-dd')
                        })
                        stats.sales++

                        // 1ヶ月分進める
                        current = addMonths(current, 1)

                        // 終了日が開始日と同じ（単発売上）の場合はループを抜ける
                        if (endDate && startDate.getTime() === endDate.getTime()) break
                    }
                }
            }
        }
        console.log('--- RECONSTRUCTION COMPLETED ---'); console.log(JSON.stringify(stats, null, 2))
    } catch (e) { console.error(e) }
}
run()
