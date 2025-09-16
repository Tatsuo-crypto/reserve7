require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function debugLogin() {
  try {
    console.log('=== ログインプロセスのデバッグ ===\n');
    
    const email = 'tandjgym@gmail.com';
    const password = '30tandjgym30';
    
    console.log('1. 入力情報:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('');
    
    console.log('2. データベース検索...');
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found in database');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Full Name:', user.full_name);
    console.log('   Store ID:', user.store_id);
    console.log('   Status:', user.status);
    console.log('');

    console.log('3. パスワード検証...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('   Password valid:', isValidPassword);
    console.log('');

    console.log('4. 管理者権限チェック...');
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const isAdmin = adminEmails.includes(user.email);
    console.log('   Admin emails:', adminEmails);
    console.log('   Is admin:', isAdmin);
    console.log('');

    console.log('5. 期待される認証結果:');
    if (isValidPassword) {
      const role = isAdmin ? 'ADMIN' : 'CLIENT';
      console.log('✅ 認証成功');
      console.log('   Role:', role);
      console.log('   User object:');
      console.log('   {');
      console.log('     id:', user.id);
      console.log('     email:', user.email);
      console.log('     name:', user.full_name);
      console.log('     role:', role);
      console.log('   }');
    } else {
      console.log('❌ 認証失敗 - パスワードが一致しません');
    }

    console.log('');
    console.log('6. 環境変数確認:');
    console.log('   SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
    console.log('   SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
    console.log('   NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
    console.log('   ADMIN_EMAILS:', process.env.ADMIN_EMAILS);

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugLogin();
