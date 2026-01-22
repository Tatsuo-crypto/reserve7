import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import fs from 'fs'
import path from 'path'
import { addMonths, startOfMonth, format, isBefore, isAfter, parse } from 'date-fns'

export const dynamic = 'force-dynamic'

const STORE_MAP: Record<string, string> = {
    '1号店': '77439c86-679a-409a-8000-2e5297e5c0e8',
    '2号店': '43296d78-13f3-4061-8d75-d38dfe907a5d'
}

// Simple CSV parser
function parseCSV(text: string): string[][] {
    const result: string[][] = []
    let row: string[] = []
    let inQuote = false
    let currentToken = ''

    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const nextChar = text[i + 1]

        if (inQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentToken += '"'
                    i++
                } else {
                    inQuote = false
                }
            } else {
                currentToken += char
            }
        } else {
            if (char === '"') {
                inQuote = true
            } else if (char === ',') {
                row.push(currentToken)
                currentToken = ''
            } else if (char === '\n' || char === '\r') {
                if (currentToken || row.length > 0) row.push(currentToken)
                if (row.length > 0) result.push(row)
                row = []
                currentToken = ''
                if (char === '\r' && nextChar === '\n') i++
            } else {
                currentToken += char
            }
        }
    }
    if (currentToken || row.length > 0) {
        row.push(currentToken)
        result.push(row)
    }
    return result
}

const normalize = (s: string) => s.replace(/[\s\u3000]/g, '')

// Parse price string "¥14,520" -> 14520
const parsePrice = (s: string) => {
    if (!s) return 0
    return parseInt(s.replace(/[¥,"]/g, ''), 10) || 0
}

interface ImportRow {
    storeName: string
    name: string
    email?: string
    plan: string
    price: number
    start: Date
    end: Date | null
    status: 'active' | 'withdrawn' | 'suspended'
}

export async function POST(request: NextRequest) {
    try {
        const activeFile = path.join(process.cwd(), 'data', '会員管理', 'シート1-在籍.csv')
        const withdrawnFile = path.join(process.cwd(), 'data', '会員管理', 'シート1-退会.csv')

        const allRows: ImportRow[] = []

        // Process Active File
        // 店,顧客名,メールアドレス,サブスクリプション名,価格,開始日,終了日,備考
        if (fs.existsSync(activeFile)) {
            const content = fs.readFileSync(activeFile, 'utf-8')
            const rows = parseCSV(content).slice(1) // skip header
            for (const r of rows) {
                if (r.length < 6) continue
                const startStr = r[5]
                if (!startStr) continue
                
                allRows.push({
                    storeName: r[0],
                    name: r[1],
                    email: r[2], // Email column
                    plan: r[3],
                    price: parsePrice(r[4]),
                    start: new Date(startStr),
                    end: r[6] ? new Date(r[6]) : null,
                    status: 'active'
                })
            }
        }

        // Process Withdrawn File
        // 店,顧客名,サブスクリプション名,価格,開始日,終了日
        if (fs.existsSync(withdrawnFile)) {
            const content = fs.readFileSync(withdrawnFile, 'utf-8')
            const rows = parseCSV(content).slice(1) // skip header
            for (const r of rows) {
                if (r.length < 6) continue
                const startStr = r[4]
                if (!startStr) continue

                allRows.push({
                    storeName: r[0],
                    name: r[1],
                    // withdrawn file doesn't have email column in index 2 usually
                    plan: r[2],
                    price: parsePrice(r[3]),
                    start: new Date(startStr),
                    end: r[5] ? new Date(r[5]) : null,
                    status: 'withdrawn'
                })
            }
        }

        // 1. Fetch users
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id, full_name, email, store_id')

        if (usersError) throw usersError

        const userMap = new Map<string, any>()
        const emailMap = new Map<string, any>()
        
        users.forEach(u => {
            userMap.set(normalize(u.full_name), u)
            if (u.email) emailMap.set(u.email.toLowerCase(), u)
        })

        // Reset tables for full import
        await supabaseAdmin.from('membership_history').delete().neq('status', 'ignore_all') 
        await supabaseAdmin.from('sales').delete().neq('amount', -1) 

        const results = {
            total: allRows.length,
            matched: 0,
            unmatched: 0,
            unmatchedNames: [] as string[],
            historyInserted: 0,
            salesInserted: 0
        }

        const today = new Date()

        // Group by User
        const userPeriods = new Map<string, ImportRow[]>()

        for (const row of allRows) {
            let user = userMap.get(normalize(row.name))
            
            // Try matching by email if name match failed
            // Case 1: Active file has explicit email column
            if (!user && row.email) {
                user = emailMap.get(row.email.toLowerCase())
            }
            
            // Case 2: Name column might be an email (seen in withdrawn file)
            if (!user && row.name.includes('@')) {
                user = emailMap.get(row.name.trim().toLowerCase())
            }

            if (!user) {
                if (!results.unmatchedNames.includes(row.name)) {
                    results.unmatchedNames.push(`${row.name} (${row.email || 'no email'})`)
                }
                results.unmatched++
                continue
            }
            results.matched++

            if (!userPeriods.has(user.id)) {
                userPeriods.set(user.id, [])
            }
            userPeriods.get(user.id)?.push(row)
        }

        // Process each user
        for (const [userId, periods] of Array.from(userPeriods.entries())) {
            const user = users.find(u => u.id === userId)
            
            // Sort by start date
            periods.sort((a, b) => a.start.getTime() - b.start.getTime())

            // 1. Generate Sales
            for (const p of periods) {
                if (p.price <= 0) continue

                let current = startOfMonth(p.start)
                // Use today as limit for open-ended, or p.end
                // If withdrawn, p.end should be the stop.
                // If active, p.end might be null -> proceed until today.
                const endLimit = p.end ? startOfMonth(p.end) : startOfMonth(today)
                
                // If start date is day 20, first payment is day 20.
                // Loop month by month.
                while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
                    let paymentDate = new Date(current.getFullYear(), current.getMonth(), p.start.getDate())
                    
                    // Don't generate future sales
                    if (isAfter(paymentDate, today)) break
                    
                    // If p.end is specified and payment date is after p.end, skip
                    if (p.end && isAfter(paymentDate, p.end)) break

                    const storeId = STORE_MAP[p.storeName] || user?.store_id

                    await supabaseAdmin.from('sales').insert({
                        user_id: userId,
                        store_id: storeId,
                        amount: p.price,
                        type: 'monthly_fee',
                        target_date: format(current, 'yyyy-MM-01'),
                        payment_date: format(paymentDate, 'yyyy-MM-dd'),
                        status: 'paid'
                    })
                    results.salesInserted++
                    
                    current = addMonths(current, 1)
                }
            }

            // 2. Generate History (Merge contiguous similar periods?)
            // Actually, for history accuracy, let's keep them as imported segments first.
            // But we need to handle "active" vs "withdrawn".
            // If "withdrawn" file record, the status for THAT period was probably active, but they withdrew at the end.
            // "Membership History" usually tracks "Active Period with Plan X".
            
            for (const p of periods) {
                // Determine store ID
                const storeId = STORE_MAP[p.storeName] || user?.store_id
                
                // Insert history
                await supabaseAdmin.from('membership_history').insert({
                    user_id: userId,
                    store_id: storeId,
                    status: 'active', // The period itself is an active subscription period
                    plan: p.plan,
                    monthly_fee: p.price,
                    start_date: format(p.start, 'yyyy-MM-dd'),
                    end_date: p.end ? format(p.end, 'yyyy-MM-dd') : null
                })
                results.historyInserted++
            }

            // 3. Update User Current Status
            // Check the very last period
            const lastPeriod = periods[periods.length - 1]
            let currentStatus = 'active'
            let currentPlan = lastPeriod.plan
            let currentFee = lastPeriod.price

            // If last record comes from "withdrawn" file or has past end date...
            if (lastPeriod.status === 'withdrawn') {
                // If the end date is in the past, they are withdrawn.
                if (lastPeriod.end && isBefore(lastPeriod.end, today)) {
                    currentStatus = 'withdrawn'
                    currentPlan = '退会' // Display as Withdrawn
                }
            } else {
                 // From active file
                 // If end date exists and is past -> suspended or withdrawn? 
                 // Usually active file with end date means "plan ended", maybe switched to another?
                 // But we are looking at the LAST period.
                 if (lastPeriod.end && isBefore(lastPeriod.end, today)) {
                     // Maybe suspended? Or just plan expired.
                     // Default to 'active' (or 'suspended'?) if in Active file but ended.
                     // Let's assume 'active' but no plan? 
                     // Or maybe 'suspended'.
                 }
            }

            // If specific plan name implies suspended?
            if (lastPeriod.plan.includes('休会')) {
                currentStatus = 'suspended'
                currentPlan = '休会'
            }

            const storeId = STORE_MAP[lastPeriod.storeName] || user?.store_id

            await supabaseAdmin.from('users').update({
                status: currentStatus,
                plan: currentPlan,
                monthly_fee: currentFee,
                store_id: storeId // Update store to latest
            }).eq('id', userId)
        }

        return NextResponse.json(results)
    } catch (error: any) {
        console.error(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
