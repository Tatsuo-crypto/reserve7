import { NextResponse } from 'next/server'
import { getVapidPublicKey, isPushConfigured } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getVapidPublicKey()

  if (!publicKey || !isPushConfigured()) {
    return NextResponse.json({ error: 'プッシュ通知の設定が未完了です' }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
