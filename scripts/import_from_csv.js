const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STORE_MAP = {
    '1号店': '77439c86-679a-409a-8000-2e5297e5c0e8',
    '2号店': '43296d78-13f3-4061-8d75-d38dfe907a5d'
};

async function importUsers() {
    const filePath = path.resolve(__dirname, 'data/会員管理/シート1-在籍.csv');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Skip header
    const dataLines = lines.slice(1).filter(line => line.trim() !== '');

    console.log(`--- Importing ${dataLines.length} users ---`);

    for (const line of dataLines) {
        // Basic CSV parse (handling potential quotes simple way)
        const parts = line.split(',');
        if (parts.length < 3) continue;

        const storeName = parts[0].trim();
        const fullName = parts[1].trim();
        const email = parts[2].trim();
        const plan = parts[3] ? parts[3].trim() : '';

        if (!email || email === '-') {
            console.log(`Skipping ${fullName} (No email)`);
            continue;
        }

        const storeId = STORE_MAP[storeName] || null;

        // Upsert user
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        const userData = {
            full_name: fullName,
            email: email.toLowerCase(),
            store_id: storeId,
            plan: plan,
            status: 'active',
            // Default password if new user
            password_hash: '$2a$10$rYm8C68Xm5G3H7g3H7g3H7g3H7g3H7g3H7g3H7g3H7g3H7g3H7g3H' // dummy hash if necessary
        };

        if (existingUser) {
            console.log(`Updating ${fullName} (${email})`);
            await supabase.from('users').update(userData).eq('id', existingUser.id);
        } else {
            console.log(`Inserting ${fullName} (${email})`);
            await supabase.from('users').insert(userData);
        }
    }

    console.log('--- Import Complete ---');
}

importUsers().catch(console.error);
