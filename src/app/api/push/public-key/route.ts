import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getVapidPublicKey()

  if (!publicKey) {
    return NextResponse.json({ error: 'プッシュ通知の設定が未完了です' }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
