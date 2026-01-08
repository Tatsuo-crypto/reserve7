import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
    // Check stores
    const { data: stores } = await supabaseAdmin.from('stores').select('*')

    // Check Store 2 Sales > 200k
    const { data: store2LargeSales } = await supabaseAdmin
        .from('sales')
        .select('*')
        .eq('store_id', '43296d78-13f3-4061-8d75-d38dfe907a5d')
        .gte('amount', 200000)

    // Also check ANY sales with exactly 342000 in ANY store
    const { data: exactSales } = await supabaseAdmin
        .from('sales')
        .select('*')
        .eq('amount', 342000)

    return NextResponse.json({
        store2LargeSales,
        exactSales
    })
}
