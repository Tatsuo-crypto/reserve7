import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAILS = ['tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com']

export async function recordDietMemberUpdate(userId: string) {
  try {
    const { data: member, error: memberError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, store_id')
      .eq('id', userId)
      .maybeSingle()

    if (memberError || !member) {
      console.error('diet update member lookup error:', memberError)
      return
    }

    let adminQuery = supabaseAdmin
      .from('users')
      .select('id')
      .in('email', ADMIN_EMAILS)

    if (member.store_id) adminQuery = adminQuery.eq('store_id', member.store_id)
    let { data: admins, error: adminError } = await adminQuery

    // 店舗情報が古い会員でも通知が欠けないよう、管理者全員へフォールバックする。
    if (!adminError && (!admins || admins.length === 0)) {
      const fallback = await supabaseAdmin
        .from('users')
        .select('id')
        .in('email', ADMIN_EMAILS)
      admins = fallback.data
      adminError = fallback.error
    }

    if (adminError || !admins?.length) {
      console.error('diet update admin lookup error:', adminError)
      return
    }

    const url = `/admin/diet-plan?userId=${member.id}`
    const now = new Date().toISOString()

    await Promise.all(admins.map(async admin => {
      const { data: existing } = await supabaseAdmin
        .from('user_notifications')
        .select('id')
        .eq('user_id', admin.id)
        .eq('category', 'diet_update')
        .eq('url', url)
        .is('read_at', null)
        .limit(1)
        .maybeSingle()

      if (existing) {
        await supabaseAdmin
          .from('user_notifications')
          .update({
            title: `${member.full_name}さんが記録しました`,
            body: 'ダイエット記録が更新されました',
            created_at: now,
          })
          .eq('id', existing.id)
        return
      }

      await supabaseAdmin.from('user_notifications').insert({
        user_id: admin.id,
        title: `${member.full_name}さんが記録しました`,
        body: 'ダイエット記録が更新されました',
        url,
        category: 'diet_update',
      })
    }))
  } catch (error) {
    // 会員の記録保存は通知の失敗で止めない。
    console.error('record diet member update error:', error)
  }
}
