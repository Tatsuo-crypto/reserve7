export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { updateMonthlyTitles, updateAllTitles, usesCumulativeCount } from '@/lib/title-utils'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { clientId, year, month } = body || {}

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId は必須です' },
        { status: 400 }
      )
    }

    // Get client plan to determine counting method
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', clientId)
      .single()

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: '会員が見つかりません' },
        { status: 404 }
      )
    }

    const plan = clientData.plan || ''
    let ok = false

    if (usesCumulativeCount(plan)) {
      // Diet/Counseling: renumber all reservations cumulatively
      ok = await updateAllTitles(clientId)
    } else {
      // Personal training: renumber by month
      if (typeof year !== 'number' || typeof month !== 'number') {
        return NextResponse.json(
          { error: 'year, month は必須です（monthは0始まり）' },
          { status: 400 }
        )
      }
      ok = await updateMonthlyTitles(clientId, year, month)
    }

    if (!ok) {
      return NextResponse.json(
        { error: '再採番に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: '再採番とGoogle再同期が完了しました' })
  } catch (error) {
    return handleApiError(error, 'Admin renumber reservations POST')
  }
}
