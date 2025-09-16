const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function cleanupDatabase() {
  try {
    console.log('データベースクリーンアップを開始します...')
    
    // 既存の予約を削除
    console.log('既存の予約を削除中...')
    const { error: reservationsError } = await supabase
      .from('reservations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // すべて削除
    
    if (reservationsError) {
      console.error('予約削除エラー:', reservationsError)
    } else {
      console.log('予約削除完了')
    }

    // 既存のユーザーを削除
    console.log('既存のユーザーを削除中...')
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // すべて削除
    
    if (usersError) {
      console.error('ユーザー削除エラー:', usersError)
    } else {
      console.log('ユーザー削除完了')
    }

    // 新しいアカウントを作成
    console.log('新しいアカウントを作成中...')
    
    const accounts = [
      {
        full_name: '1号店管理者',
        email: 'tandjgym@gmail.com',
        password_hash: '$2b$12$TAvixg1KXmHUJfbHC3a3Q.uMEFX0PacPb2mXaOo3ifLT2656.Mrn2',
        store_id: 'tandjgym@gmail.com'
      },
      {
        full_name: '2号店管理者',
        email: 'tandjgym2goutenn@gmail.com',
        password_hash: '$2b$12$TAvixg1KXmHUJfbHC3a3Q.uMEFX0PacPb2mXaOo3ifLT2656.Mrn2',
        store_id: 'tandjgym2goutenn@gmail.com'
      },
      {
        full_name: '1号店会員',
        email: 'member1@example.com',
        password_hash: '$2b$12$KmYLqY1oDroiqs6dbCKgaOFeR6.wk..T/aGUH4XPpLQZ5bOGvuugC',
        store_id: 'tandjgym@gmail.com'
      },
      {
        full_name: '2号店会員',
        email: 'member2@example.com',
        password_hash: '$2b$12$aSpoWUVhvGHDGRtUoB.z7uKbelYpTSsiXJaWS1mHdU7hbRx8JISN.',
        store_id: 'tandjgym2goutenn@gmail.com'
      }
    ]

    for (const account of accounts) {
      const { error } = await supabase
        .from('users')
        .insert([account])
      
      if (error) {
        console.error(`${account.full_name} 作成エラー:`, error)
      } else {
        console.log(`${account.full_name} (${account.email}) 作成完了`)
      }
    }

    console.log('データベースクリーンアップ完了！')
    console.log('\n作成されたアカウント:')
    console.log('1号店管理者: tandjgym@gmail.com (パスワード: 30tandjgym30)')
    console.log('2号店管理者: tandjgym2goutenn@gmail.com (パスワード: 30tandjgym30)')
    console.log('1号店会員: member1@example.com (パスワード: member1@example.com)')
    console.log('2号店会員: member2@example.com (パスワード: member2@example.com)')

  } catch (error) {
    console.error('クリーンアップ中にエラーが発生しました:', error)
  }
}

cleanupDatabase()
