import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/api-utils'
import { canViewMaterial, isMaterialPublicNow, normalizeStringArray, toMaterialListItem, type SharedMaterialRow } from '@/lib/materials'

export const dynamic = 'force-dynamic'

const BUCKET = 'shared-materials'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullableDate(value: string) {
  return value ? new Date(value).toISOString() : null
}

function safeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'material'
}

async function uploadFile(file: File) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}${ext ? '' : ''}`
  const arrayBuffer = await file.arrayBuffer()
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) throw error
  return path
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 200)
  const memberId = searchParams.get('memberId')

  let memberViewer: { audience: 'member'; id: string; isDiet: boolean } | null = null
  if (memberId) {
    const { data: member, error: memberError } = await supabaseAdmin
      .from('users')
      .select('id, status, lifestyle_settings!left(visible_tabs)')
      .eq('id', memberId)
      .maybeSingle()

    if (memberError) {
      console.error('admin materials member lookup error:', memberError)
      return NextResponse.json({ error: '会員情報を取得できませんでした' }, { status: 500 })
    }

    if (!member || member.status !== 'active') {
      return NextResponse.json({ materials: [] })
    }

    const settings = Array.isArray((member as any).lifestyle_settings)
      ? (member as any).lifestyle_settings[0]
      : (member as any).lifestyle_settings
    const tabs = settings?.visible_tabs || {}
    memberViewer = {
      audience: 'member',
      id: member.id,
      isDiet: tabs.input === true || tabs.analyze === true || tabs.progress === true,
    }
  }

  let query = supabaseAdmin
    .from('shared_materials')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(memberViewer ? 100 : limit)

  if (memberViewer) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('admin materials GET error:', error)
    return NextResponse.json({ error: '資料を取得できませんでした' }, { status: 500 })
  }

  const rows = memberViewer
    ? ((data || []) as SharedMaterialRow[])
      .filter(material => isMaterialPublicNow(material) && canViewMaterial(material, memberViewer))
      .slice(0, limit)
    : ((data || []) as SharedMaterialRow[])

  return NextResponse.json({
    materials: rows.map(material =>
      toMaterialListItem(material, `/api/materials/${material.id}/open`)
    ),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await request.formData()
    const title = textValue(formData, 'title')
    const materialType = textValue(formData, 'materialType') || 'link'
    const description = textValue(formData, 'description')
    const externalUrl = textValue(formData, 'externalUrl')
    const isPublished = textValue(formData, 'isPublished') === 'true'
    const publishStartAt = nullableDate(textValue(formData, 'publishStartAt'))
    const publishEndAt = nullableDate(textValue(formData, 'publishEndAt'))
    const displayOrder = Number(textValue(formData, 'displayOrder')) || 0
    const targetGroups = normalizeStringArray(formData.get('targetGroups'))
    const targetUserIds = normalizeStringArray(formData.get('targetUserIds'))
    const targetTrainerIds = normalizeStringArray(formData.get('targetTrainerIds'))
    const file = formData.get('file')

    if (!title) return NextResponse.json({ error: 'タイトルを入力してください' }, { status: 400 })
    if (!['pdf', 'image', 'video', 'link'].includes(materialType)) {
      return NextResponse.json({ error: '資料の種類が不正です' }, { status: 400 })
    }
    if (targetGroups.length === 0 && targetUserIds.length === 0 && targetTrainerIds.length === 0) {
      return NextResponse.json({ error: '公開対象を選択してください' }, { status: 400 })
    }

    let storagePath: string | null = null
    if (file instanceof File && file.size > 0) {
      storagePath = await uploadFile(file)
    }

    if (!externalUrl && !storagePath) {
      return NextResponse.json({ error: 'ファイルまたはURLを指定してください' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('shared_materials')
      .insert({
        title,
        description: description || null,
        material_type: materialType,
        external_url: externalUrl || null,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        is_published: isPublished,
        publish_start_at: publishStartAt,
        publish_end_at: publishEndAt,
        display_order: displayOrder,
        target_groups: targetGroups,
        target_user_ids: targetUserIds,
        target_trainer_ids: targetTrainerIds,
        created_by: auth.user.email,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      material: toMaterialListItem(data as SharedMaterialRow, `/api/materials/${data.id}/open`),
    })
  } catch (error) {
    console.error('admin materials POST error:', error)
    return NextResponse.json({ error: '資料を保存できませんでした' }, { status: 500 })
  }
}
