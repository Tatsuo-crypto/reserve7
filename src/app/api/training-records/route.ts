import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

// AN-4: トレーニングカルテのセッション(来店1回分)を取得または新規作成する(find-or-create)。
// 予約タップ経由(reservationId)の場合、同じ予約に対して重複してセッションが作られないよう、
// training_sessions.reservation_idにDB側でユニーク制約を張ってあるのと合わせて、
// 既存セッションがあればそれを返し、無ければ作る。
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { reservationId, userId } = body as { reservationId?: string; userId?: string }

    if (!reservationId && !userId) {
      return createErrorResponse('reservationIdまたはuserIdが必要です', 400)
    }

    if (reservationId) {
      const { data: existing } = await supabaseAdmin
        .from('training_sessions')
        .select('id')
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ id: existing.id, created: false })
      }

      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select('id, client_id, trainer_id, start_time')
        .eq('id', reservationId)
        .single()

      if (reservationError || !reservation) {
        return createErrorResponse('予約が見つかりません', 404)
      }
      if (!reservation.client_id) {
        return createErrorResponse('この予約には会員が紐づいていないため、カルテを作成できません', 400)
      }

      const sessionDate = format(new Date(reservation.start_time), 'yyyy-MM-dd')
      const trainerId = auth.actorType === 'trainer' ? auth.trainerId : reservation.trainer_id

      const { data: created, error: insertError } = await supabaseAdmin
        .from('training_sessions')
        .insert({
          reservation_id: reservationId,
          user_id: reservation.client_id,
          trainer_id: trainerId,
          session_date: sessionDate,
        })
        .select('id')
        .single()

      if (insertError || !created) {
        return createErrorResponse('カルテの作成に失敗しました', 500)
      }

      return NextResponse.json({ id: created.id, created: true })
    }

    // userId経由(予約に紐づかない単発カルテ)
    const { data: created, error: insertError } = await supabaseAdmin
      .from('training_sessions')
      .insert({
        user_id: userId,
        trainer_id: auth.actorType === 'trainer' ? auth.trainerId : null,
        session_date: format(new Date(), 'yyyy-MM-dd'),
      })
      .select('id')
      .single()

    if (insertError || !created) {
      return createErrorResponse('カルテの作成に失敗しました', 500)
    }

    return NextResponse.json({ id: created.id, created: true })
  } catch (error) {
    console.error('training-records POST error:', error)
    return createErrorResponse('カルテの作成に失敗しました', 500)
  }
}
