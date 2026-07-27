import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AN-4: トレーニングカルテ機能用の会員一覧(トレーナー向け「会員一覧」画面のデータ元)。
// 既存の/api/admin/membersは機能が多く管理者専用の項目も含むため、カルテ用途に絞った
// シンプルな一覧を別途用意する(既存の会員管理機能には手を入れない)。
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('query') || '').trim()

    let q = supabaseAdmin
      .from('users')
      .select('id, full_name, plan, status, store_id, stores:store_id(name)')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .neq('status', 'withdrawn')
      .order('full_name', { ascending: true })

    if (query) {
      q = q.ilike('full_name', `%${query}%`)
    }

    const { data, error } = await q

    if (error) return createErrorResponse('会員一覧の取得に失敗しました', 500)

    const members = (data || []).map((u: any) => ({
      id: u.id,
      fullName: u.full_name,
      plan: u.plan,
      status: u.status,
      storeName: (Array.isArray(u.stores) ? u.stores[0]?.name : u.stores?.name) || null,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    console.error('training-records/members GET error:', error)
    return createErrorResponse('会員一覧の取得に失敗しました', 500)
  }
}
