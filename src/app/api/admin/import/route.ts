import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import fs from 'fs'
import path from 'path'
import { addMonths, startOfMonth, format, isBefore, isAfter, parse } from 'date-fns'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
    try {
        // New filename
        const fileName = '顧客CSV.csv'
        const filePath = path.join(process.cwd(), 'data', fileName)

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found: ' + fileName }, { status: 404 })
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const rows = parseCSV(fileContent)

        // Header: 顧客名,サブスクリプション名,価格,開始日,終了日
        const dataRows = rows.slice(1)

        // 1. Fetch users
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id, full_name, store_id')

        if (usersError) throw usersError

        const userMap = new Map<string, any>()
        users.forEach(u => {
            userMap.set(normalize(u.full_name), u)
        })

        // Reset tables for full import
        await supabaseAdmin.from('membership_history').delete().neq('status', 'ignore_all') // Delete all
        await supabaseAdmin.from('sales').delete().neq('amount', -1) // Delete all

        const results = {
            total: dataRows.length,
            matched: 0,
            unmatched: 0,
            unmatchedNames: [] as string[],
            historyInserted: 0,
            salesInserted: 0,
            errors: [] as string[]
        }

        const today = new Date()

        // Build timeline for each user to merge continuous periods
        const userPeriods = new Map<string, { start: Date, end: Date | null, price: number, plan: string }[]>()

        // dataRows loop
        for (const row of dataRows) {
            if (row.length < 4) continue
            const name = row[0]
            const plan = row[1]
            const priceStr = row[2]
            const startDateStr = row[3]
            const endDateStr = row[4]

            if (!name) continue

            const user = userMap.get(normalize(name))
            if (!user) {
                if (!results.unmatchedNames.includes(name)) {
                    results.unmatchedNames.push(name)
                }
                results.unmatched++
                continue
            }
            results.matched++

            const startDate = new Date(startDateStr)
            // If endDateStr is empty, it means active/ongoing -> null
            // If endDateStr is present, parse it
            let endDate: Date | null = endDateStr ? new Date(endDateStr) : null

            if (isNaN(startDate.getTime())) continue
            if (endDate && isNaN(endDate.getTime())) endDate = null // Fallback

            const price = parsePrice(priceStr)

            // Store for processing
            if (!userPeriods.has(user.id)) {
                userPeriods.set(user.id, [])
            }
            userPeriods.get(user.id)?.push({ start: startDate, end: endDate, price, plan })
        }

        // Process per user
        const userPeriodEntries = Array.from(userPeriods.entries())
        for (const [userId, periods] of userPeriodEntries) {
            const user = users.find(u => u.id === userId)

            // Sort periods
            periods.sort((a, b) => a.start.getTime() - b.start.getTime())

            // 1. Create Sales Records (Monthly)
            // For each period, generate monthly sales from start to end (or now)
            for (const p of periods) {
                if (p.price <= 0) continue

                let current = startOfMonth(p.start)
                const endLimit = p.end ? startOfMonth(p.end) : startOfMonth(today)

                // Generate sales records for each month
                while (isBefore(current, endLimit) || current.getTime() === endLimit.getTime()) {
                    // If start date is in future relative to this month? 
                    // Logic: "Monthly fee" usually charged on start date or 1st of month.
                    // Let's assume charged on the 'start date day' of each month.

                    // If this month is the start month, date is p.start.
                    // Else, date is YYYY-MM-{p.start.getDate()}

                    let paymentDate = new Date(current.getFullYear(), current.getMonth(), p.start.getDate())

                    // If payment date > end date (and end date exists), stop?
                    // If p.end is set, and payment date is after p.end, don't charge?
                    // Usually if end date is 2/5, and payment is 2/20, no charge in Feb.
                    // If payment is 2/1, charge.

                    if (p.end && isAfter(paymentDate, p.end)) {
                        // Skip this month if payment date is after end date
                        break
                    }

                    // Don't generate future sales beyond "now" for analytics accuracy 
                    // (or user might want projections? let's stick to past/now)
                    if (isAfter(paymentDate, today)) {
                        break
                    }

                    // Insert sale
                    const { error } = await supabaseAdmin.from('sales').insert({
                        user_id: userId,
                        store_id: user?.store_id,
                        amount: p.price,
                        type: 'monthly_fee',
                        target_date: format(current, 'yyyy-MM-01'),
                        payment_date: format(paymentDate, 'yyyy-MM-dd')
                    })
                    if (!error) results.salesInserted++

                    current = addMonths(current, 1)
                }
            }

            // 2. Create Membership History (Merge logic)
            // Simple merge: if gap < 10 days, merge.
            const merged: { start: Date, end: Date | null }[] = []
            let currentP = { start: periods[0].start, end: periods[0].end }

            for (let i = 1; i < periods.length; i++) {
                const next = periods[i]

                // Check overlap or proximity
                // Effective end of current period
                const currentEnd = currentP.end

                if (!currentEnd) {
                    // Current is open-ended.
                    // If next starts after current start, it's either an upgrade or overlapping plan?
                    // Depending on logic, usually means "New plan started".
                    // If upgrade, old plan ends previous day?
                    // Let's assume next.start replaces current.
                    currentP.end = new Date(next.start.getTime() - 86400000) // day before
                    merged.push(currentP)
                    currentP = { start: next.start, end: next.end }
                } else {
                    // Gap check
                    const gap = next.start.getTime() - currentEnd.getTime()
                    const gapDays = gap / (1000 * 60 * 60 * 24)

                    if (gapDays < 15 && gapDays > -100) { // Allow overlap and small gap
                        // Merge
                        // New end is whichever is later (or null)
                        if (!next.end) {
                            currentP.end = null
                        } else if (next.end > currentEnd) {
                            currentP.end = next.end
                        }
                    } else {
                        // Seperate
                        merged.push(currentP)
                        currentP = { start: next.start, end: next.end }
                    }
                }
            }
            merged.push(currentP)

            // Insert History
            for (const m of merged) {
                // If end date is future, set null
                let dbEnd = m.end
                if (m.end && isAfter(m.end, today)) {
                    dbEnd = null
                }

                const { error } = await supabaseAdmin.from('membership_history').insert({
                    user_id: userId,
                    store_id: user?.store_id,
                    status: 'active',
                    start_date: format(m.start, 'yyyy-MM-dd'),
                    end_date: dbEnd ? format(dbEnd, 'yyyy-MM-dd') : null
                })
                if (!error) results.historyInserted++
            }

            // Update User Status in 'users' table
            // Check the very last period of the user (chronologically)
            const lastPeriod = periods[periods.length - 1]
            let newUserStatus = 'active'

            // If last period has end date AND it's in the past -> withdrawn
            if (lastPeriod.end && isBefore(lastPeriod.end, today)) {
                newUserStatus = 'withdrawn'
            }

            // Update user
            // Note: Only update if changed? For now just update to ensure consistency.
            await supabaseAdmin
                .from('users')
                .update({ status: newUserStatus })
                .eq('id', userId)
        }

        return NextResponse.json(results)
    } catch (error: any) {
        console.error(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
