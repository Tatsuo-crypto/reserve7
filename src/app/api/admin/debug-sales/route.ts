import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AI-2: このデバッグ用エンドポイントに認証チェックが無く、未認証で売上データ(店舗・金額)が
// 誰でも閲覧できてしまっていたのを修正(経営レポート作成中の監査で発見)。
export async function GET() {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
        return createErrorResponse('Unauthorized', 401)
    }

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
