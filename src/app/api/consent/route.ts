import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal-versions'

export const dynamic = 'force-dynamic'

type SubjectType = 'member' | 'trainer_staff' | 'admin'

function isValidSubjectType(value: string | null): value is SubjectType {
  return value === 'member' || value === 'trainer_staff' || value === 'admin'
}

// GET /api/consent?subjectType=member&subjectId=xxx
// 現行バージョンの利用規約・プライバシーポリシーに同意済みかどうかを返す
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const subjectType = searchParams.get('subjectType')
    const subjectId = searchParams.get('subjectId')

    if (!isValidSubjectType(subjectType) || !subjectId) {
      return NextResponse.json({ error: 'subjectType, subjectIdが必要です' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('consent_records')
      .select('id')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .eq('terms_version', TERMS_VERSION)
      .eq('privacy_version', PRIVACY_VERSION)
      .maybeSingle()

    if (error) {
      console.error('Consent lookup error:', error)
      return NextResponse.json({ error: '同意状態の確認に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      agreed: !!data,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    })
  } catch (error) {
    console.error('Consent GET error:', error)
    return NextResponse.json({ error: '同意状態の確認に失敗しました' }, { status: 500 })
  }
}

// POST /api/consent { subjectType, subjectId }
// 現行バージョンの利用規約・プライバシーポリシーへの同意を記録する
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subjectType, subjectId } = body as { subjectType?: string; subjectId?: string }

    if (!isValidSubjectType(subjectType ?? null) || !subjectId) {
      return NextResponse.json({ error: 'subjectType, subjectIdが必要です' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('consent_records')
      .upsert(
        {
          subject_type: subjectType,
          subject_id: subjectId,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          agreed_at: new Date().toISOString(),
        },
        { onConflict: 'subject_type,subject_id,terms_version,privacy_version' }
      )

    if (error) {
      console.error('Consent insert error:', error)
      return NextResponse.json({ error: '同意の記録に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Consent POST error:', error)
    return NextResponse.json({ error: '同意の記録に失敗しました' }, { status: 500 })
  }
}
