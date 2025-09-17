import { supabase } from '@/lib/supabase'

export interface MonthlyUsage {
  currentCount: number
  maxCount: number
  planName: string
}

export function getPlanMaxCount(plan: string): number {
  switch (plan) {
    case '月2回': return 2
    case '月4回': return 4
    case '月6回': return 6
    case '月8回': return 8
    case 'ダイエットコース': return 8 // ダイエットコースは月8回相当
    default: return 4
  }
}

export async function getMonthlyReservationCount(userId: string, year: number, month: number): Promise<number> {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00+00:00`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00+00:00`
  
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id')
    .eq('client_id', userId)
    .gte('start_time', startDate)
    .lt('start_time', endDate)

  if (error) {
    console.error('Error fetching monthly reservations:', error)
    return 0
  }

  return reservations?.length || 0
}

export async function getUserMonthlyUsage(userId: string): Promise<MonthlyUsage> {
  // Get user's plan
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return { currentCount: 0, maxCount: 4, planName: '月4回' }
  }

  const planName = user.plan || '月4回'
  const maxCount = getPlanMaxCount(planName)
  
  // Get current month's reservation count
  const now = new Date()
  const currentCount = await getMonthlyReservationCount(userId, now.getFullYear(), now.getMonth() + 1)

  return {
    currentCount,
    maxCount,
    planName
  }
}
