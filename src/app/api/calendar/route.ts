import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

type CalendarUser = {
  id: string
  email: string
  name: string
  isAdmin: boolean
  isTrainer?: boolean
  storeId: string
  calendarId?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const scope = searchParams.get('scope') || 'all'
    const includeReservations = scope !== 'availability'
    const includeAvailability = scope !== 'reservations'

    let user: CalendarUser | null = null
    let tokenUser: { id: string } | null = null

    if (token) {
      const { data: trainerData } = await supabaseAdmin
        .from('trainers')
        .select('id, email, full_name, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (trainerData) {
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('calendar_id')
          .eq('id', trainerData.store_id)
          .single()

        user = {
          id: trainerData.id,
          email: trainerData.email,
          name: trainerData.full_name,
          isAdmin: false,
          isTrainer: true,
          storeId: trainerData.store_id,
          calendarId: store?.calendar_id,
        }
      } else {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, store_id')
          .eq('access_token', token)
          .single()

        if (userData) {
          tokenUser = { id: userData.id }
          user = {
            id: userData.id,
            email: userData.email,
            name: userData.full_name,
            isAdmin: false,
            storeId: userData.store_id,
          }
        }
      }

      if (!user) {
        return createErrorResponse('無効なアクセストークンです', 401)
      }
    } else {
      user = await getAuthenticatedUser() as CalendarUser | null
      if (!user) {
        return createErrorResponse('認証が必要です', 401)
      }
    }

    const calendarId = user.calendarId || user.storeId
    const storeId = user.storeId

    let reservationsQuery = supabaseAdmin
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        calendar_id,
        client_id,
        trainer_id,
        users!client_id (
          id,
          full_name,
          email,
          plan
        )
      `)
      .eq('calendar_id', calendarId)
      .order('start_time', { ascending: true })

    if (start) reservationsQuery = reservationsQuery.gte('start_time', start)
    if (end) reservationsQuery = reservationsQuery.lte('start_time', end)

    if (!user.isAdmin && !user.isTrainer) {
      reservationsQuery = reservationsQuery.eq('client_id', tokenUser?.id || user.id)
    }

    let reservationsResultPromise: PromiseLike<any> | Promise<any> = Promise.resolve({ data: [], error: null })
    if (includeReservations) {
      reservationsResultPromise = reservationsQuery
    }

    if (!includeAvailability) {
      const reservationsResult = await reservationsResultPromise

      if (reservationsResult.error) {
        console.error('Calendar reservations fetch error:', reservationsResult.error)
        return createErrorResponse('予約の取得に失敗しました', 500)
      }

      const reservations = (reservationsResult.data || []).map((reservation: any) => ({
        id: reservation.id,
        title: reservation.title,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        notes: reservation.notes,
        calendarId: reservation.calendar_id,
        trainerId: reservation.trainer_id,
        client: reservation.client_id ? {
          id: (reservation.users as any).id,
          fullName: (reservation.users as any).full_name,
          email: (reservation.users as any).email,
          plan: (reservation.users as any).plan,
        } : (reservation.title && reservation.title.includes('ゲスト')) ? {
          id: 'guest',
          fullName: 'ゲスト予約',
          email: 'guest@system',
          plan: '都度',
        } : (reservation.title && reservation.title.includes('体験')) ? {
          id: 'trial',
          fullName: '体験予約',
          email: 'trial@system',
          plan: null,
        } : (reservation.title && reservation.title === '研修') ? {
          id: 'training',
          fullName: '研修',
          email: 'training@system',
          plan: null,
        } : {
          id: 'blocked',
          fullName: '予約不可時間',
          email: 'blocked@system',
          plan: null,
        }
      }))

      return createSuccessResponse({
        reservations,
        shifts: [],
        templates: [],
        trainers: [],
      })
    }

    const { data: trainers, error: trainerError } = await supabaseAdmin
      .from('trainers')
      .select('id, full_name, email')
      .eq('store_id', storeId)
      .eq('status', 'active')

    if (trainerError) {
      console.error('Calendar trainers fetch error:', trainerError)
      return createErrorResponse('トレーナー情報の取得に失敗しました', 500)
    }

    const trainerIds = (trainers || []).map(t => t.id)

    let shiftsQuery = trainerIds.length > 0
      ? supabaseAdmin
        .from('trainer_shifts')
        .select('id, trainer_id, start_time, end_time')
        .in('trainer_id', trainerIds)
        .order('start_time', { ascending: true })
      : null

    if (shiftsQuery && start) shiftsQuery = shiftsQuery.gte('end_time', start)
    if (shiftsQuery && end) shiftsQuery = shiftsQuery.lte('start_time', end)

    const [reservationsResult, shiftsResult, templatesResult] = await Promise.all([
      reservationsResultPromise,
      shiftsQuery || Promise.resolve({ data: [], error: null }),
      trainerIds.length > 0
        ? supabaseAdmin
          .from('trainer_shift_templates')
          .select('id, trainer_id, day_of_week, start_time, end_time')
          .in('trainer_id', trainerIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (reservationsResult.error) {
      console.error('Calendar reservations fetch error:', reservationsResult.error)
      return createErrorResponse('予約の取得に失敗しました', 500)
    }

    if (shiftsResult.error) {
      console.error('Calendar shifts fetch error:', shiftsResult.error)
      return createErrorResponse('シフトの取得に失敗しました', 500)
    }

    if (templatesResult.error) {
      console.error('Calendar templates fetch error:', templatesResult.error)
    }

    const trainerNameById = new Map((trainers || []).map(t => [t.id, t.full_name]))

    const reservations = (reservationsResult.data || []).map((reservation: any) => ({
      id: reservation.id,
      title: reservation.title,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      notes: reservation.notes,
      calendarId: reservation.calendar_id,
      trainerId: reservation.trainer_id,
      client: reservation.client_id ? {
        id: (reservation.users as any).id,
        fullName: (reservation.users as any).full_name,
        email: (reservation.users as any).email,
        plan: (reservation.users as any).plan,
      } : (reservation.title && reservation.title.includes('ゲスト')) ? {
        id: 'guest',
        fullName: 'ゲスト予約',
        email: 'guest@system',
        plan: '都度',
      } : (reservation.title && reservation.title.includes('体験')) ? {
        id: 'trial',
        fullName: '体験予約',
        email: 'trial@system',
        plan: null,
      } : (reservation.title && reservation.title === '研修') ? {
        id: 'training',
        fullName: '研修',
        email: 'training@system',
        plan: null,
      } : {
        id: 'blocked',
        fullName: '予約不可時間',
        email: 'blocked@system',
        plan: null,
      }
    }))

    return createSuccessResponse({
      reservations,
      shifts: (shiftsResult.data || []).map(s => ({
        id: s.id,
        trainerId: s.trainer_id,
        trainerName: trainerNameById.get(s.trainer_id),
        startTime: s.start_time,
        endTime: s.end_time,
      })),
      templates: (templatesResult.data || []).map(t => ({
        id: t.id,
        trainerId: t.trainer_id,
        trainerName: trainerNameById.get(t.trainer_id),
        dayOfWeek: t.day_of_week,
        startTime: t.start_time,
        endTime: t.end_time,
      })),
      trainers: (trainers || []).map(t => ({
        id: t.id,
        name: t.full_name,
        email: t.email,
      })),
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    return createErrorResponse('サーバーエラーが発生しました', 500)
  }
}
