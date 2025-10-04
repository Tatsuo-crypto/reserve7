export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { updateMonthlyTitles } from '@/lib/title-utils'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { clientId, year, month } = body || {}

    if (!clientId || typeof year !== 'number' || typeof month !== 'number') {
      return NextResponse.json(
        { error: 'clientId, year, month は必須です（monthは0始まり）' },
        { status: 400 }
      )
    }

    const ok = await updateMonthlyTitles(clientId, year, month)
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
