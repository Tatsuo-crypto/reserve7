require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAllUsers() {
  try {
    console.log('=== データベース全ユーザー確認 ===\n');
    
    // Get all users from database
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ データベースにユーザーが存在しません');
      return;
    }

    console.log(`✅ 合計 ${users.length} 人のユーザーが見つかりました:\n`);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`--- ユーザー ${i + 1} ---`);
      console.log('ID:', user.id);
      console.log('Email:', user.email);
      console.log('Full Name:', user.full_name);
      console.log('Store ID:', user.store_id);
      console.log('Status:', user.status || 'active');
      console.log('Created At:', user.created_at);
      console.log('Password Hash exists:', !!user.password_hash);
      
      if (user.password_hash) {
        console.log('Password Hash (first 30 chars):', user.password_hash.substring(0, 30) + '...');
        
        // Test common passwords for this user
        const testPasswords = ['30tandjgym30', 'password', 'admin', 'tandjgym', '123456'];
        for (const pwd of testPasswords) {
          try {
            const isValid = await bcrypt.compare(pwd, user.password_hash);
            if (isValid) {
              console.log(`🔑 Password "${pwd}" is VALID for ${user.email}`);
            }
          } catch (err) {
            console.log(`❌ Error testing password "${pwd}":`, err.message);
          }
        }
      }
      console.log('');
    }

    // Specific check for tandjgym@gmail.com
    console.log('=== tandjgym@gmail.com 詳細確認 ===');
    const targetUser = users.find(u => u.email === 'tandjgym@gmail.com');
    if (targetUser) {
      console.log('✅ tandjgym@gmail.com が見つかりました');
      console.log('- ID:', targetUser.id);
      console.log('- Full Name:', targetUser.full_name);
      console.log('- Store ID:', targetUser.store_id);
      console.log('- Status:', targetUser.status || 'active');
      
      // Test the specific password
      const testPassword = '30tandjgym30';
      const isValidPassword = await bcrypt.compare(testPassword, targetUser.password_hash);
      console.log(`- Password "${testPassword}" is valid:`, isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ パスワードが一致しません！');
        console.log('パスワードハッシュ:', targetUser.password_hash);
      }
    } else {
      console.log('❌ tandjgym@gmail.com が見つかりません');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllUsers();
