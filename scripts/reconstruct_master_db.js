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
    return s.replace(/[\s\u3000]/g, '')
        .replace(/[﨑]/g, '崎')
        .replace(/[髙]/g, '高')
        .replace(/[ヶケ]/g, 'ケ');
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
        console.log('--- Database Reconstruction Start ---')

        const inStockData = parseCSV(fs.readFileSync(path.join(process.cwd(), 'data', 'シート1-在籍.csv'), 'utf-8')).slice(1)
        const withdrawnData = parseCSV(fs.readFileSync(path.join(process.cwd(), 'data', 'シート1-退会.csv'), 'utf-8')).slice(1)

        // 1. 全ユーザー情報の整理
        const personGroups = new Map() // Normalized Name -> { originalName, rows[], isActive }

        for (const row of inStockData) {
            const name = row[1]; if (!name) continue
            const nName = normalizeName(name)
            if (!personGroups.has(nName)) personGroups.set(nName, { originalName: name, rows: [], isActive: true })
            personGroups.get(nName).rows.push(row)
            personGroups.get(nName).isActive = true
        }
        for (const row of withdrawnData) {
            const name = row[1]; if (!name) continue
            const nName = normalizeName(name)
            if (!personGroups.has(nName)) personGroups.set(nName, { originalName: name, rows: [], isActive: false })
            personGroups.get(nName).rows.push(row)
        }

        // 2. データベースのクリーンアップ (売上、履歴を全消去して再構築)
        console.log('Clearing sales and membership_history...')
        await supabaseAdmin.from('membership_history').delete().neq('status', 'ignore_all')
        await supabaseAdmin.from('sales').delete().neq('amount', -1)

        // 管理者以外の全ユーザーを一旦削除（カスケード削除で関連データも消えることを期待）
        const { data: currentUsers } = await supabaseAdmin.from('users').select('id, full_name, email')
        const memberIdsToDelete = currentUsers
            .filter(u => !ADMIN_EMAILS.includes(u.email))
            .map(u => u.id)

        if (memberIdsToDelete.length > 0) {
            console.log(`Deleting ${memberIdsToDelete.length} existing members for a clean state...`)
            await supabaseAdmin.from('users').delete().in('id', memberIdsToDelete)
        }

        const today = new Date()
        const stats = { usersCreated: 0, salesInserted: 0, historyInserted: 0 }
        let timestamp = Date.now()

        // 3. ユーザーごとのインポート
        for (const [nName, person] of personGroups.entries()) {
            // 代表となる店舗IDを選択（最新または在籍シート優先）
            const repRow = person.rows.find(r => person.isActive ? true : true) // 最初の一行
            const storeId = STORES[repRow[0]] || STORES['1号店']

            // 会員作成
            const dummyEmail = `no-email-${timestamp++}@example.com`
            const { data: user, error: userError } = await supabaseAdmin.from('users').insert({
                full_name: person.originalName,
                email: dummyEmail,
                password_hash: DUMMY_HASH,
                role: 'member',
                store_id: storeId,
                status: person.isActive ? 'active' : 'withdrawn'
            }).select().single()

            if (userError) {
                console.error(`Error creating user ${person.originalName}:`, userError.message)
                continue
            }
            stats.usersCreated++

            // 会員に関連する全履歴と売上を処理
            for (const row of person.rows) {
                const rowStoreId = STORES[row[0]] || STORES['1号店']
                const planName = row[2]
                const price = parseInt((row[3] || '').replace(/[¥,"]/g, ''), 10) || 0
                const startDate = new Date(row[4])
                const endDate = row[5] ? new Date(row[5]) : null
                if (isNaN(startDate.getTime())) continue

                // 履歴登録
                await supabaseAdmin.from('membership_history').insert({
                    user_id: user.id,
                    store_id: rowStoreId,
                    status: 'active',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null
                })
                stats.historyInserted++

                // 売上登録
                if (price > 0) {
                    let current = startOfMonth(startDate)
                    const endLimit = endDate ? startOfMonth(endDate) : startOfMonth(today)
                    while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
                        let paymentDate = new Date(current.getFullYear(), current.getMonth(), Math.min(startDate.getDate(), 28))
                        if (endDate && isAfter(paymentDate, endDate)) break
                        if (isAfter(paymentDate, today)) break

                        await supabaseAdmin.from('sales').insert({
                            user_id: user.id,
                            store_id: rowStoreId,
                            amount: price,
                            type: (planName.includes('都度') || planName.includes('カウンセリング')) ? 'one_time' : 'monthly_fee',
                            target_date: format(current, 'yyyy-MM-01'),
                            payment_date: format(paymentDate, 'yyyy-MM-dd')
                        })
                        stats.salesInserted++
                        current = addMonths(current, 1)
                    }
                }
            }
        }

        console.log('--- RECONSTRUCTION COMPLETED ---')
        console.log(JSON.stringify(stats, null, 2))

        // 重複チェックレポート
        const duplicates = []
        const uniqueNames = Array.from(personGroups.keys())
        for (let i = 0; i < uniqueNames.length; i++) {
            for (let j = i + 1; j < uniqueNames.length; j++) {
                // 仮の類似判定ロジック（もっと高度なこともできますが今回は一旦パス）
            }
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e)
    }
}
run()
