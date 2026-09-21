import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BUCKET = 'shared-materials'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function safeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'material'
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : ''
    const fileSize = Number(body.fileSize)

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'ファイルは50MB以下にしてください' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'PDF、JPEG、PNG、WebPのみ登録できます' }, { status: 400 })
    }

    const path = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(fileName)}`
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false })

    if (error || !data) {
      console.error('material signed upload URL error:', error)
      return NextResponse.json({ error: 'ファイルの保存準備に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ path: data.path, token: data.token })
  } catch (error) {
    console.error('material upload preparation error:', error)
    return NextResponse.json({ error: 'ファイルの保存準備に失敗しました' }, { status: 500 })
  }
}
