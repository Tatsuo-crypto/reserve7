import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type SetInput = {
  id?: string
  setNumber: number
  weight: number | null
  reps: number | null
  assisted: boolean
  memo: string | null
}

type ExerciseInput = {
  id?: string
  exerciseName: string
  sortOrder: number
  sets: SetInput[]
}

// AN-4: トレーニングカルテ1件(セッション+種目カード+セット)の取得・更新・削除。
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, reservation_id, user_id, trainer_id, session_date, session_type, approach, overall_note, users:user_id(full_name), trainers:trainer_id(full_name)')
      .eq('id', params.id)
      .single()

    if (sessionError || !session) return createErrorResponse('カルテが見つかりません', 404)

    let reservation: { title: string | null; start_time: string | null; end_time: string | null } | null = null
    if (session.reservation_id) {
      const { data: reservationData } = await supabaseAdmin
        .from('reservations')
        .select('title, start_time, end_time')
        .eq('id', session.reservation_id)
        .maybeSingle()

      reservation = reservationData || null
    }

    const { data: exercises, error: exercisesError } = await supabaseAdmin
      .from('training_exercises')
      .select('id, exercise_name, sort_order')
      .eq('session_id', params.id)
      .order('sort_order', { ascending: true })

    if (exercisesError) return createErrorResponse('カルテの取得に失敗しました', 500)

    const exerciseIds = (exercises || []).map((e) => e.id)
    let setsByExercise = new Map<string, any[]>()
    if (exerciseIds.length > 0) {
      const { data: sets, error: setsError } = await supabaseAdmin
        .from('training_sets')
        .select('id, exercise_id, set_number, weight, reps, assisted, memo')
        .in('exercise_id', exerciseIds)
        .order('set_number', { ascending: true })

      if (setsError) return createErrorResponse('カルテの取得に失敗しました', 500)

      for (const s of sets || []) {
        const list = setsByExercise.get(s.exercise_id) || []
        list.push(s)
        setsByExercise.set(s.exercise_id, list)
      }
    }

    const memberName = Array.isArray(session.users) ? session.users[0]?.full_name : (session.users as any)?.full_name
    const trainerName = Array.isArray(session.trainers) ? session.trainers[0]?.full_name : (session.trainers as any)?.full_name

    return NextResponse.json({
      id: session.id,
      reservationId: session.reservation_id,
      userId: session.user_id,
      memberName: memberName || null,
      trainerName: trainerName || null,
      sessionDate: session.session_date,
      reservationTitle: reservation?.title || null,
      reservationStartTime: reservation?.start_time || null,
      reservationEndTime: reservation?.end_time || null,
      sessionType: session.session_type,
      approach: session.approach,
      overallNote: session.overall_note,
      exercises: (exercises || []).map((e) => ({
        id: e.id,
        exerciseName: e.exercise_name,
        sortOrder: e.sort_order,
        sets: (setsByExercise.get(e.id) || []).map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          weight: s.weight,
          reps: s.reps,
          assisted: s.assisted,
          memo: s.memo,
        })),
      })),
    })
  } catch (error) {
    console.error('training-records/[id] GET error:', error)
    return createErrorResponse('カルテの取得に失敗しました', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { sessionType, approach, overallNote, exercises } = body as {
      sessionType?: string
      approach?: string
      overallNote?: string
      exercises: ExerciseInput[]
    }

    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        session_type: sessionType || null,
        approach: approach || null,
        overall_note: overallNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) return createErrorResponse('カルテの更新に失敗しました', 500)

    // シンプルさ優先で、種目・セットは全削除→再作成する(セッションあたりの件数が少ないため許容範囲)
    const { error: deleteError } = await supabaseAdmin
      .from('training_exercises')
      .delete()
      .eq('session_id', params.id)

    if (deleteError) return createErrorResponse('カルテの更新に失敗しました', 500)

    for (const exercise of exercises || []) {
      if (!exercise.exerciseName?.trim()) continue

      const { data: insertedExercise, error: exerciseError } = await supabaseAdmin
        .from('training_exercises')
        .insert({
          session_id: params.id,
          exercise_name: exercise.exerciseName.trim(),
          sort_order: exercise.sortOrder,
        })
        .select('id')
        .single()

      if (exerciseError || !insertedExercise) {
        return createErrorResponse('カルテの更新に失敗しました', 500)
      }

      const setsToInsert = (exercise.sets || []).map((set, index) => ({
        exercise_id: insertedExercise.id,
        set_number: set.setNumber ?? index + 1,
        weight: set.weight,
        reps: set.reps,
        assisted: !!set.assisted,
        memo: set.memo || null,
      }))

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabaseAdmin
          .from('training_sets')
          .insert(setsToInsert)

        if (setsError) return createErrorResponse('カルテの更新に失敗しました', 500)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('training-records/[id] PUT error:', error)
    return createErrorResponse('カルテの更新に失敗しました', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { error } = await supabaseAdmin
      .from('training_sessions')
      .delete()
      .eq('id', params.id)

    if (error) return createErrorResponse('カルテの削除に失敗しました', 500)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('training-records/[id] DELETE error:', error)
    return createErrorResponse('カルテの削除に失敗しました', 500)
  }
}
