
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function probeTable() {
    const columns = ['calories', 'protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt', 'image_url', 'notes'];
    const results = {};
    
    for (const col of columns) {
        const { error } = await supabase
            .from('diet_logs')
            .select(col)
            .limit(1);
        
        results[col] = error ? 'MISSING/ERROR' : 'OK';
        if (error) console.log(`${col}: ${error.message}`);
    }
    
    console.log('Column check results:', results);
}

probeTable();
