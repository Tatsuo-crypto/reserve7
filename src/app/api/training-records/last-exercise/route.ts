import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AN-4: 「前回記録」参照。同じ会員が同じ種目名で行った直近のセット内容を返す
// (今回編集中のセッションは除外する)。
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const exerciseName = searchParams.get('exerciseName')
    const excludeSessionId = searchParams.get('excludeSessionId')

    if (!userId || !exerciseName) {
      return createErrorResponse('userIdとexerciseNameが必要です', 400)
    }

    let sessionsQuery = supabaseAdmin
      .from('training_sessions')
      .select('id, session_date')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })

    if (excludeSessionId) {
      sessionsQuery = sessionsQuery.neq('id', excludeSessionId)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) return createErrorResponse('前回記録の取得に失敗しました', 500)

    const sessionIds = (sessions || []).map((s) => s.id)
    if (sessionIds.length === 0) {
      return NextResponse.json({ found: false })
    }

    const { data: exercises, error: exercisesError } = await supabaseAdmin
      .from('training_exercises')
      .select('id, session_id')
      .in('session_id', sessionIds)
      .eq('exercise_name', exerciseName)

    if (exercisesError) return createErrorResponse('前回記録の取得に失敗しました', 500)
    if (!exercises || exercises.length === 0) {
      return NextResponse.json({ found: false })
    }

    // sessionsは日付降順なので、その順にマッチする一番新しいexerciseを選ぶ
    const sessionOrder = new Map(sessionIds.map((id, index) => [id, index]))
    const latestExercise = exercises.sort(
      (a, b) => (sessionOrder.get(a.session_id) ?? 0) - (sessionOrder.get(b.session_id) ?? 0)
    )[0]

    const matchedSession = (sessions || []).find((s) => s.id === latestExercise.session_id)

    const { data: sets, error: setsError } = await supabaseAdmin
      .from('training_sets')
      .select('set_number, weight, reps, assisted, memo')
      .eq('exercise_id', latestExercise.id)
      .order('set_number', { ascending: true })

    if (setsError) return createErrorResponse('前回記録の取得に失敗しました', 500)

    return NextResponse.json({
      found: true,
      sessionDate: matchedSession?.session_date || null,
      sets: sets || [],
    })
  } catch (error) {
    console.error('training-records/last-exercise GET error:', error)
    return createErrorResponse('前回記録の取得に失敗しました', 500)
  }
}
