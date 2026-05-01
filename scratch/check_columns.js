
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'diet_logs' });
    
    if (error) {
        // If RPC doesn't exist, try a simple select from information_schema
        const { data: cols, error: err2 } = await supabase
            .from('diet_logs')
            .select('*')
            .limit(0);
        
        if (err2) {
            console.error('Error:', err2);
        } else {
            // This is tricky as limit 0 might not give columns in all clients
            console.log('Fetching columns via select limit 0...');
            // Actually, let's just try to insert a record with NO columns and see what we get?
            // No, better to use the information_schema if possible via SQL.
            // But we can't run raw SQL easily without RPC.
        }
    } else {
        console.log('Columns:', data);
    }
}

// Alternative: Try to get columns using the JS client metadata if available
async function trySelect() {
    const { data, error } = await supabase.from('diet_logs').select().limit(1);
    if (data && data.length > 0) {
        console.log('Existing columns:', Object.keys(data[0]));
    } else {
        console.log('Table is empty, trying to find another way...');
        // Try to insert a dummy record with JUST user_id and date
        const dummy = { user_id: 'test', date: '2000-01-01' };
        // This will likely fail if user_id 'test' doesn't exist, but it might give us a hint.
    }
}

trySelect();
