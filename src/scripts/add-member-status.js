const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

async function addMemberStatusColumn() {
  try {
    console.log('データベースにstatusカラムを追加中...')
    
    // Execute the SQL to add status column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add status column with default value 'active'
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

        -- Add constraint to ensure only valid status values
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'users_status_check'
          ) THEN
            ALTER TABLE users 
            ADD CONSTRAINT users_status_check 
            CHECK (status IN ('active', 'suspended', 'withdrawn'));
          END IF;
        END $$;

        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

        -- Update existing users to have 'active' status
        UPDATE users 
        SET status = 'active' 
        WHERE status IS NULL OR status = '';
      `
    })

    if (error) {
      console.error('SQL実行エラー:', error)
      
      // If rpc doesn't work, try direct column addition
      console.log('直接カラム追加を試行中...')
      
      const { error: directError } = await supabase
        .from('users')
        .select('status')
        .limit(1)
      
      if (directError && directError.message.includes('column "status" does not exist')) {
        console.log('statusカラムが存在しません。手動でSQLを実行してください。')
        console.log('\n以下のSQLをSupabaseのSQL Editorで実行してください:')
        console.log('----------------------------------------')
        console.log(`
-- Add status column with default value 'active'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Add constraint to ensure only valid status values
ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'withdrawn'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update existing users to have 'active' status
UPDATE users 
SET status = 'active' 
WHERE status IS NULL OR status = '';
        `)
        console.log('----------------------------------------')
        return
      }
    } else {
      console.log('statusカラムの追加が完了しました!')
    }

    // Verify the column was added
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, status')
      .limit(5)
    
    if (fetchError) {
      console.error('検証エラー:', fetchError)
    } else {
      console.log('現在のユーザー状態:')
      users.forEach(user => {
        console.log(`- ${user.email}: ${user.status || 'undefined'}`)
      })
    }

    console.log('\nステータス値の説明:')
    console.log('- active: 在籍')
    console.log('- suspended: 休会') 
    console.log('- withdrawn: 退会')

  } catch (error) {
    console.error('スクリプト実行エラー:', error)
  }
}

addMemberStatusColumn()
