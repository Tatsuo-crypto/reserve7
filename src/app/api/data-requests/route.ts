import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type SubjectType = 'member' | 'trainer_staff'
type RequestType = 'export' | 'delete'

function isValidSubjectType(value: string | null): value is SubjectType {
  return value === 'member' || value === 'trainer_staff'
}

function isValidRequestType(value: string | null): value is RequestType {
  return value === 'export' || value === 'delete'
}

// POST /api/data-requests { subjectType, subjectId, subjectName, subjectEmail, requestType }
// 会員/トレーナーが自分のデータのエクスポート・削除をリクエストする。
// 即時自動処理はせず、管理者が対応するためのキューに記録する。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subjectType, subjectId, subjectName, subjectEmail, requestType } = body as {
      subjectType?: string
      subjectId?: string
      subjectName?: string
      subjectEmail?: string
      requestType?: string
    }

    if (!isValidSubjectType(subjectType ?? null) || !subjectId || !isValidRequestType(requestType ?? null)) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('data_requests').insert({
      subject_type: subjectType,
      subject_id: subjectId,
      subject_name: subjectName || null,
      subject_email: subjectEmail || null,
      request_type: requestType,
      status: 'pending',
    })

    if (error) {
      console.error('Data request insert error:', error)
      return NextResponse.json({ error: 'リクエストの送信に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Data request POST error:', error)
    return NextResponse.json({ error: 'リクエストの送信に失敗しました' }, { status: 500 })
  }
}

// GET /api/data-requests
// 管理者向け: 未対応のリクエスト一覧を取得する
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('data_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Data request list error:', error)
      return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ requests: data || [] })
  } catch (error) {
    console.error('Data request GET error:', error)
    return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 })
  }
}
