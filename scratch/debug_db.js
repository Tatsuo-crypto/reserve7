const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users } = await supabase.from('users').select('*').ilike('full_name', '%安並%');
    console.log('Users found:', JSON.stringify(users, null, 2));
    
    if (users && users.length > 0) {
        const userId = users[0].id;
        const { data: goals } = await supabase.from('diet_goals').select('*').eq('user_id', userId).order('start_date', { ascending: false });
        console.log('Goals found for user:', JSON.stringify(goals, null, 2));
    }
}

run();
