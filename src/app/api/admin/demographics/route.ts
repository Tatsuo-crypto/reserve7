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

// AH-5: 退会済み会員の実績値のみを対象にした「平均継続期間」の算出。
// membership_historyの各ユーザーの記録(active/suspended=在籍中、withdrawn=退会マーカー)を時系列で見て、
// 「在籍中(active/suspended)の最後の記録にend_dateが付いていて、かつそれ以降に在籍記録が無い」ユーザーを
// 退会済みとみなす。継続期間 = そのユーザーの最初の在籍開始日 〜 最後の在籍終了日。
type TenureHistoryRow = {
  user_id: string
  start_date: string
  end_date: string | null
  status: string
}

function calcAverageTenure(history: TenureHistoryRow[]): {
  churnedMemberCount: number
  averageTenureDays: number | null
  averageTenureLabel: string | null
} {
  const byUser = new Map<string, TenureHistoryRow[]>()
  for (const row of history) {
    const list = byUser.get(row.user_id) || []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  const tenureDaysList: number[] = []

  for (const rows of Array.from(byUser.values())) {
    const connected = rows
      .filter((r) => r.status === 'active' || r.status === 'suspended')
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    if (connected.length === 0) continue

    const firstStart = new Date(connected[0].start_date)
    const last = connected[connected.length - 1]

    // 最後の在籍記録が終了日を持たない(=今も在籍中)場合は退会済みとしない
    if (!last.end_date) continue

    const finalEnd = new Date(last.end_date)
    if (Number.isNaN(firstStart.getTime()) || Number.isNaN(finalEnd.getTime())) continue
    if (finalEnd <= firstStart) continue

    const tenureDays = Math.round((finalEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60 * 24))
    tenureDaysList.push(tenureDays)
  }

  if (tenureDaysList.length === 0) {
    return { churnedMemberCount: 0, averageTenureDays: null, averageTenureLabel: null }
  }

  const averageTenureDays = Math.round(
    tenureDaysList.reduce((sum, d) => sum + d, 0) / tenureDaysList.length
  )

  const months = averageTenureDays / 30.44
  const years = Math.floor(months / 12)
  const remainingMonths = Math.round(months - years * 12)
  const averageTenureLabel = years > 0
    ? `${years}年${remainingMonths}ヶ月`
    : `${Math.round(months)}ヶ月`

  return { churnedMemberCount: tenureDaysList.length, averageTenureDays, averageTenureLabel }
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

    // AH-5: 平均継続期間(退会済み会員の実績値のみ)
    let tenureQuery = supabaseAdmin
      .from('membership_history')
      .select('user_id, start_date, end_date, status, store_id')
    if (storeId && storeId !== 'all') {
      tenureQuery = tenureQuery.eq('store_id', storeId)
    }
    const { data: tenureHistory, error: tenureError } = await tenureQuery.limit(100000)

    if (tenureError) {
      console.error('Demographics: membership_history error', tenureError)
    }

    const { churnedMemberCount, averageTenureDays, averageTenureLabel } = calcAverageTenure(
      (tenureHistory || []) as TenureHistoryRow[]
    )

    return NextResponse.json({
      totalMembers: users?.length || 0,
      ageGroups,
      genderBreakdown,
      jobBreakdown,
      mainPurposeBreakdown,
      routeBreakdown,
      retention: {
        churnedMemberCount,
        averageTenureDays,
        averageTenureLabel,
      },
    })
  } catch (error) {
    console.error('Demographics API error:', error)
    return createErrorResponse('統計データの取得に失敗しました', 500)
  }
}
