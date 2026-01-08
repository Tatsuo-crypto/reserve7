import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function parseCSV(text: string): string[][] {
    const result: string[][] = []
    let row: string[] = []
    let inQuote = false
    let currentToken = ''
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (inQuote) {
            if (char === '"') {
                if (text[i + 1] === '"') { currentToken += '"'; i++ }
                else { inQuote = false }
            } else { currentToken += char }
        } else {
            if (char === '"') { inQuote = true }
            else if (char === ',') { row.push(currentToken); currentToken = '' }
            else if (char === '\n' || char === '\r') {
                if (currentToken || row.length > 0) row.push(currentToken)
                if (row.length > 0) result.push(row)
                row = []; currentToken = ''
                if (char === '\r' && text[i + 1] === '\n') i++
            } else { currentToken += char }
        }
    }
    if (currentToken || row.length > 0) { row.push(currentToken); result.push(row) }
    return result
}

const normalize = (s: string) => s.replace(/[\s\u3000]/g, '')

export async function POST(request: NextRequest) {
    try {
        const fileName = '顧客CSV - 下記の形式◇でスプレッドシートにまとめ直して_◇顧客名、サブスクリプション名、価格、開始日、終了日....csv'
        const filePath = path.join(process.cwd(), 'data', fileName)

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const rows = parseCSV(fileContent)
        const dataRows = rows.slice(1)

        // Fetch existing users
        const { data: users } = await supabaseAdmin.from('users').select('full_name')
        const existingNames = new Set((users || []).map(u => normalize(u.full_name)))

        const missingUsers = new Map<string, { name: string, plan: string, endStr: string }>()

        // Default store IDs (Hardcoded for now, or fetch?)
        // Need UUIDs. Let's fetch stores.
        const { data: stores } = await supabaseAdmin.from('stores').select('id, name')
        const store1 = stores?.find(s => s.name.includes('1号店'))?.id
        const store2 = stores?.find(s => s.name.includes('2号店'))?.id
        // Fallback store
        const defaultStore = store1 || '00000000-0000-0000-0000-000000000000'

        dataRows.forEach(row => {
            const name = row[0]
            const plan = row[1]
            const endStr = row[4]

            if (!name) return

            // Check if name is email
            // Not handling email extraction logic here for simplicity, assuming Name column is Name

            if (!existingNames.has(normalize(name))) {
                if (!missingUsers.has(normalize(name))) {
                    missingUsers.set(normalize(name), { name, plan, endStr })
                }
            }
        })

        // Generate SQL
        let sql = `-- SQL to insert missing users from CSV
-- Generated at ${new Date().toISOString()}

`

        const values: string[] = []

        missingUsers.forEach((info) => {
            // Guess store from plan name
            let storeId = defaultStore
            if (info.plan.includes('2号店')) storeId = store2 || defaultStore
            else if (info.plan.includes('1号店')) storeId = store1 || defaultStore

            // Status
            let status = 'active'
            const endDate = info.endStr ? new Date(info.endStr) : null
            if (endDate && endDate < new Date()) {
                status = 'withdrawn'
            }

            // Email (dummy)
            // User requested name(-) format for ALL missing users to avoid conflicts/identify them
            // Append '-' to denote it's a generated ID/past record
            let email = `${info.name}-`

            // Escape
            const cleanName = info.name.replace(/'/g, "''")
            const cleanEmail = email.replace(/'/g, "''")
            const cleanPlan = info.plan.replace(/'/g, "''")
            // status check constraint in DB: active, suspended, withdrawn

            values.push(`('${cleanName}', '${cleanEmail}', '', '${status}', '${storeId}', '${cleanPlan}')`)
        })

        if (values.length > 0) {
            sql += `INSERT INTO public.users (full_name, email, password_hash, status, store_id, plan)
VALUES
${values.join(',\n')};
`
        } else {
            sql += `-- No missing users found.`
        }

        return NextResponse.json({ count: missingUsers.size, sql })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
