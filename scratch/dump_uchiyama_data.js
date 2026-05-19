const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function dumpAllData() {
    const { data: users } = await supabase.from('users').select('id, full_name').ilike('full_name', '%内山%');
    const userId = users[0].id;
    console.log('User:', users[0]);

    // 1. Get ALL lifestyle logs for this user
    const { data: lifeLogs } = await supabase.from('lifestyle_logs').select('*').eq('user_id', userId);
    console.log('\n--- ALL Lifestyle Logs ---');
    console.table(lifeLogs.map(l => ({ date: l.date, steps: l.steps, water: l.water_liters, sleep: l.sleep_hours })));

    // 2. Get ALL diet logs for this user (to see if they trigger something)
    const { data: dietLogs } = await supabase.from('diet_logs').select('*').eq('user_id', userId);
    console.log('\n--- ALL Diet Logs ---');
    console.table(dietLogs.map(d => ({ date: d.date, cals: d.calories })));
}

dumpAllData();
