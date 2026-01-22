require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateEmails() {
  try {
    console.log('=== メールアドレス更新開始 ===\n');

    // CSVファイルの読み込み
    const csvPath = path.join(__dirname, 'data', '会員管理', 'シート1-在籍.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split(/\r?\n/);
    
    // 名前とメールアドレスのマッピング作成
    const emailMap = new Map();
    
    // ヘッダーをスキップ
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // CSVパース（簡易版）
      // 形式: 店,顧客名,メールアドレス,...
      const parts = line.split(',');
      const name = parts[1]; // 顧客名
      const email = parts[2]; // メールアドレス
      
      if (name && email) {
        // 名前の前後の空白を削除
        const cleanName = name.trim();
        const cleanEmail = email.trim();
        emailMap.set(cleanName, cleanEmail);
      }
    }
    
    console.log(`CSVから ${emailMap.size} 件のメールアドレス情報を読み込みました。`);

    // データベースからユーザー取得
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`DBから ${users.length} 人のユーザーを取得しました。\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      // 管理者アカウント等はスキップ
      if (user.email === 'tandjgym@gmail.com' || user.email === 'tandjgym2goutenn@gmail.com') {
        continue;
      }

      const csvEmail = emailMap.get(user.full_name);
      
      if (csvEmail) {
        // メールアドレスが変更不要ならスキップ
        if (user.email === csvEmail) {
          console.log(`Skipping ${user.full_name}: Already has correct email (${csvEmail})`);
          skippedCount++;
          continue;
        }

        // メールアドレスが'-'の場合の処理
        // 重複エラーを避けるため、一旦そのまま更新を試みる
        // 失敗したらエラーログを出す
        
        console.log(`Updating ${user.full_name}: ${user.email} -> ${csvEmail}`);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ email: csvEmail })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ Failed to update ${user.full_name}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ Updated ${user.full_name}`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️ No CSV entry found for ${user.full_name} (Current: ${user.email})`);
        
        // CSVにない場合、指示に従って "-" にするべきか？
        // 画像のリストにある人は全員CSVにあるはずなので、ここに来るのはCSVにない人
        // 今回の指示は「detaフォルダのCSVファイルを参照してくださいもしメールアドレスがない場合は-にしてください」
        // これは「CSVのエントリのメールアドレス欄が空の場合」を指している可能性が高い。
        // CSV自体に載っていないユーザーを勝手に "-" にするのは危険かもしれないが、
        // ユーザーの意図としては「リストにある名前のメールアドレスを正しくしてほしい」ということ。
      }
    }

    console.log('\n=== 更新完了 ===');
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateEmails();
