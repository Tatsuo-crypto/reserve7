const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addMemoColumn() {
  try {
    console.log('Adding memo column to users table...')
    
    // Check if column already exists
    const { data: columns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('column_name', 'memo')
    
    if (checkError) {
      console.error('Error checking column existence:', checkError)
      return
    }
    
    if (columns && columns.length > 0) {
      console.log('Memo column already exists')
      return
    }
    
    // Add the column using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE users ADD COLUMN memo TEXT;'
    })
    
    if (error) {
      console.error('Error adding memo column:', error)
    } else {
      console.log('Successfully added memo column to users table')
    }
  } catch (err) {
    console.error('Exception:', err.message)
  }
}

addMemoColumn()
