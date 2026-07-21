import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type CounselingProfile = {
  job?: string
  mainPurpose?: string
  route?: string
}

function calcAgeGroup(birthDate: string | null): string {
  if (!birthDate) return '不明'
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return '不明'
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  if (age < 20) return '10代以下'
  if (age < 30) return '20代'
  if (age < 40) return '30代'
  if (age < 50) return '40代'
  if (age < 60) return '50代'
  return '60代以上'
}

const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  no_answer: '回答しない',
}

function tally(values: (string | undefined | null)[], unknownLabel = '未入力'): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const raw of values) {
    const label = raw && raw.trim() ? raw.trim() : unknownLabel
    map.set(label, (map.get(label) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// GET /api/admin/demographics?storeId=xxx
// 会員の年齢層・男女比・職業傾向・主な入会目的・入会経路を集計する。
// 対象は登録済みの全会員(在籍・休会・退会を問わない、集客傾向の把握を目的とするため)。
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
      return createErrorResponse('Unauthorized', 401)
    }

    const storeId = request.nextUrl.searchParams.get('storeId')

    let usersQuery = supabaseAdmin.from('users').select('id, birth_date, gender, store_id')
    if (storeId && storeId !== 'all') {
      usersQuery = usersQuery.eq('store_id', storeId)
    }
    const { data: users, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Demographics: users error', usersError)
      return createErrorResponse('会員データの取得に失敗しました', 500)
    }

    const userIds = (users || []).map((u) => u.id)

    const { data: settingsRows, error: settingsError } = userIds.length
      ? await supabaseAdmin
          .from('lifestyle_settings')
          .select('user_id, habit_targets')
          .in('user_id', userIds)
      : { data: [], error: null }

    if (settingsError) {
      console.error('Demographics: lifestyle_settings error', settingsError)
    }

    const profileByUserId = new Map<string, CounselingProfile>()
    for (const row of settingsRows || []) {
      const profile = (row.habit_targets as any)?.counseling_profile as CounselingProfile | undefined
      if (profile) profileByUserId.set(row.user_id, profile)
    }

    const ageGroups = tally((users || []).map((u) => calcAgeGroup(u.birth_date)), '不明')
    const genderBreakdown = tally(
      (users || []).map((u) => (u.gender ? GENDER_LABELS[u.gender] || u.gender : undefined)),
      '不明'
    )
    const jobBreakdown = tally((users || []).map((u) => profileByUserId.get(u.id)?.job))
    const mainPurposeBreakdown = tally((users || []).map((u) => profileByUserId.get(u.id)?.mainPurpose))
    const routeBreakdown = tally((users || []).map((u) => profileByUserId.get(u.id)?.route))

    return NextResponse.json({
      totalMembers: users?.length || 0,
      ageGroups,
      genderBreakdown,
      jobBreakdown,
      mainPurposeBreakdown,
      routeBreakdown,
    })
  } catch (error) {
    console.error('Demographics API error:', error)
    return createErrorResponse('統計データの取得に失敗しました', 500)
  }
}
