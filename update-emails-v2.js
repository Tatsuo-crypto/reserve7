require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateEmailsV2() {
  try {
    console.log('=== メールアドレス更新開始 (V2) ===\n');

    const emailMap = new Map();

    // 1. 在籍CSV読み込み
    const activePath = path.join(__dirname, 'data', '会員管理', 'シート1-在籍.csv');
    const activeContent = fs.readFileSync(activePath, 'utf-8');
    const activeLines = activeContent.split(/\r?\n/);
    
    for (let i = 1; i < activeLines.length; i++) {
      const line = activeLines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      const name = parts[1] ? parts[1].trim() : '';
      const email = parts[2] ? parts[2].trim() : '';
      
      if (name) {
        // メールアドレスが '-' の場合もそのまま記録
        emailMap.set(name, email);
      }
    }
    console.log(`在籍リストから ${emailMap.size} 件読み込みました。`);

    // 2. 退会CSV読み込み
    const inactivePath = path.join(__dirname, 'data', '会員管理', 'シート1-退会.csv');
    const inactiveContent = fs.readFileSync(inactivePath, 'utf-8');
    const inactiveLines = inactiveContent.split(/\r?\n/);

    let inactiveCount = 0;
    for (let i = 1; i < inactiveLines.length; i++) {
      const line = inactiveLines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      const name = parts[1] ? parts[1].trim() : '';
      
      if (name && !emailMap.has(name)) {
        // 在籍リストにない名前の場合、メールアドレスなし（'-'候補）として登録
        emailMap.set(name, '-');
        inactiveCount++;
      }
    }
    console.log(`退会リストから ${inactiveCount} 件の新規名前を追加しました。`);
    console.log(`合計対象者数: ${emailMap.size}\n`);

    // 3. データベースからユーザー取得
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let uniqueConstraintCount = 0;

    for (const user of users) {
      // 管理者はスキップ
      if (user.email === 'tandjgym@gmail.com' || user.email === 'tandjgym2goutenn@gmail.com') {
        continue;
      }

      const csvEmail = emailMap.get(user.full_name);
      
      if (csvEmail) {
        // 現状と一致していればスキップ
        if (user.email === csvEmail) {
          skippedCount++;
          continue;
        }

        // 更新対象
        console.log(`Updating ${user.full_name}: ${user.email} -> ${csvEmail}`);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ email: csvEmail })
          .eq('id', user.id);

        if (updateError) {
          if (updateError.code === '23505') { // unique_violation
            console.warn(`⚠️ Cannot set email to "${csvEmail}" for ${user.full_name}: Unique constraint violation`);
            uniqueConstraintCount++;
            
            // オプション: ユニーク制約回避のために連番を付けるなどの処理？
            // 今回はユーザー指示が「-にしてください」なので、
            // できない場合は報告に留めるか、もしくは '-' + ID のような形式にするか。
            // いったんスキップ。
          } else {
            console.error(`❌ Failed to update ${user.full_name}:`, updateError.message);
            errorCount++;
          }
        } else {
          console.log(`✅ Updated ${user.full_name}`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️ No entry found for ${user.full_name} (Current: ${user.email})`);
        
        // CSVに全くないユーザー。
        // リクエストに従い '-' にするべきか？
        // ここでも '-' への更新を試みる価値はあるが、
        // 既に誰かが '-' になっているとUniqueエラーになる。
      }
    }

    console.log('\n=== 更新完了 ===');
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Unique Constraint Violations: ${uniqueConstraintCount}`);
    console.log(`Other Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateEmailsV2();
