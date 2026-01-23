require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTanaka() {
  console.log('田中さんのデータを確認中...\n')
  
  // Find Tanaka in users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('full_name', '%田中%')
  
  if (userError) {
    console.error('Error:', userError)
    return
  }
  
  console.log('=== 田中さんのユーザー情報 ===')
  users.forEach(u => {
    console.log(`ID: ${u.id}`)
    console.log(`名前: ${u.full_name}`)
    console.log(`ステータス: ${u.status}`)
    console.log(`プラン: ${u.plan}`)
    console.log(`作成日: ${u.created_at}`)
    console.log('')
  })
  
  if (users.length === 0) {
    console.log('田中さんが見つかりません')
    return
  }
  
  // Get membership history
  for (const user of users) {
    console.log(`\n=== ${user.full_name} の履歴 ===`)
    const { data: history, error: histError } = await supabase
      .from('membership_history')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })
    
    if (histError) {
      console.error('Error:', histError)
      continue
    }
    
    history.forEach((h, idx) => {
      console.log(`\n履歴 ${idx + 1}:`)
      console.log(`  ステータス: ${h.status}`)
      console.log(`  開始日: ${h.start_date}`)
      console.log(`  終了日: ${h.end_date}`)
      console.log(`  プラン: ${h.plan}`)
      console.log(`  月会費: ${h.monthly_fee}`)
      console.log(`  店舗ID: ${h.store_id}`)
    })
  }
}

checkTanaka()
