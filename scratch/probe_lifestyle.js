
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function probeLifestyle() {
    const columns = ['user_id', 'date', 'weight', 'water', 'steps', 'sleep', 'alcohol', 'notes', 'habits', 'workout'];
    const results = {};
    
    for (const col of columns) {
        const { error } = await supabase
            .from('lifestyle_logs')
            .select(col)
            .limit(1);
        
        results[col] = error ? 'MISSING/ERROR' : 'OK';
        if (error) console.log(`${col}: ${error.message}`);
    }
    
    console.log('Lifestyle Column check results:', results);
}

probeLifestyle();
