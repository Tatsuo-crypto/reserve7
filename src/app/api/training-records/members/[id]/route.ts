import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AN-4: トレーニングカルテ画面のヘッダー表示用の会員基本情報+カルテ履歴一覧。
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { data: member, error: memberError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, plan, status')
      .eq('id', params.id)
      .single()

    if (memberError || !member) return createErrorResponse('会員が見つかりません', 404)

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, session_date, session_type, trainer_id, trainers:trainer_id(full_name), training_exercises(id)')
      .eq('user_id', params.id)
      .order('session_date', { ascending: false })

    if (sessionsError) return createErrorResponse('カルテ履歴の取得に失敗しました', 500)

    const history = (sessions || []).map((s: any) => ({
      id: s.id,
      sessionDate: s.session_date,
      sessionType: s.session_type,
      trainerName: (Array.isArray(s.trainers) ? s.trainers[0]?.full_name : s.trainers?.full_name) || null,
      exerciseCount: (s.training_exercises || []).length,
    }))

    return NextResponse.json({
      member: { id: member.id, fullName: member.full_name, plan: member.plan, status: member.status },
      history,
    })
  } catch (error) {
    console.error('training-records/members/[id] GET error:', error)
    return createErrorResponse('会員情報の取得に失敗しました', 500)
  }
}
