require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateEmailsFinal() {
  try {
    console.log('=== メールアドレス更新開始 (Final) ===\n');

    const emailMap = new Map();

    // 1. 在籍CSV
    const activePath = path.join(__dirname, 'data', '会員管理', 'シート1-在籍.csv');
    const activeContent = fs.readFileSync(activePath, 'utf-8');
    const activeLines = activeContent.split(/\r?\n/);
    
    for (let i = 1; i < activeLines.length; i++) {
      const line = activeLines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      const name = parts[1] ? parts[1].trim() : '';
      const email = parts[2] ? parts[2].trim() : '';
      if (name) emailMap.set(name, email);
    }

    // 2. 退会CSV
    const inactivePath = path.join(__dirname, 'data', '会員管理', 'シート1-退会.csv');
    const inactiveContent = fs.readFileSync(inactivePath, 'utf-8');
    const inactiveLines = inactiveContent.split(/\r?\n/);

    for (let i = 1; i < inactiveLines.length; i++) {
      const line = inactiveLines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      const name = parts[1] ? parts[1].trim() : '';
      if (name && !emailMap.has(name)) {
        emailMap.set(name, '-');
      }
    }

    // DB取得
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) throw error;

    let updatedCount = 0;

    for (const user of users) {
      if (user.email === 'tandjgym@gmail.com' || user.email === 'tandjgym2goutenn@gmail.com') continue;

      const csvEmail = emailMap.get(user.full_name);
      let newEmail = csvEmail;

      if (!newEmail || newEmail === '-') {
        // メールアドレスがない、または '-' の場合は、ユニークなダミーアドレスを設定
        newEmail = `no-email-${user.id}@gym.internal`;
      }

      if (user.email !== newEmail) {
        console.log(`Updating ${user.full_name}: ${user.email} -> ${newEmail}`);
        const { error: updateError } = await supabase
          .from('users')
          .update({ email: newEmail })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`❌ Failed: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`\nUpdated ${updatedCount} users.`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateEmailsFinal();
