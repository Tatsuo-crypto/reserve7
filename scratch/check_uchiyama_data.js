const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    // 1. Find user
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, full_name')
        .ilike('full_name', '%内山%');
    
    if (userError || !users || users.length === 0) {
        console.error('User not found:', userError);
        return;
    }

    console.log('Found users:', users);
    const userId = users[0].id;

    // 2. Fetch lifestyle logs
    const { data: logs, error: logError } = await supabase
        .from('lifestyle_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', '2026-05-04')
        .lte('date', '2026-05-10')
        .order('date', { ascending: true });

    if (logError) {
        console.error('Error fetching logs:', logError);
        return;
    }

    console.log('Lifestyle logs for 5/4 - 5/10:');
    console.table(logs.map(l => ({
        date: l.date,
        steps: l.steps,
        water: l.water_liters,
        sleep: l.sleep_hours,
        id: l.id
    })));
}

checkData();
