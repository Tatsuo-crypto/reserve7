const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Step 111 のログから抽出した、削除されたユーザーのリスト
const USERS_TO_RESTORE = [
    { full_name: "marikyon2@gmail.com", email: "marikyon2@gmail.com-", status: "active" },
    { full_name: "奈緒 高木", email: "奈緒 高木-", status: "active" },
    { full_name: "麻梨奈 牛木", email: "麻梨奈 牛木-", status: "active" },
    { full_name: "荒谷 彰子", email: "bff-no.1@ezweb.ne.jp", status: "withdrawn" },
    { full_name: "三好 ", email: "pistolmark@gmail.com", status: "active" },
    { full_name: "山口 由加里", email: "yukari.6823@gmail.com", status: "active" },
    { full_name: "山崎 ジジオ千春", email: "chiharuyama567@gmail.com", status: "active" },
    { full_name: "廣井 結", email: "ohisama33yui26@gmail.com", status: "active" },
    { full_name: "橘木 美穂子", email: "miho4689@gmail.com", status: "active" },
    { full_name: "2号店 テスト", email: "test2@gmail.com", status: "suspended" },
    { full_name: "テスト ", email: "test@gmail.com", status: "withdrawn" },
    { full_name: "テ スト", email: "mitsuoo@icloud.com", status: "suspended" },
    { full_name: "田中 えりこ？", email: "chikamorieriko@gmail.com", status: "active" },
    { full_name: "浅山 扇代", email: "no-email-1765522955110-ntp799@example.com", status: "active" },
    { full_name: "eriko chika", email: "eriko chika-", status: "active" },
    { full_name: "村岸直子", email: "村岸直子-", status: "withdrawn" },
    { full_name: "kazsuz12161015@iclud.com", email: "kazsuz12161015@iclud.com", status: "withdrawn" },
    { full_name: "caz03900@gmail.com", email: "caz03900@gmail.com", status: "withdrawn" },
    { full_name: "satokotomono&@gmail.com", email: "satokotomono&@gmail.com", status: "withdrawn" },
    { full_name: "智子 八木原", email: "智子 八木原-", status: "withdrawn" },
    { full_name: "愛 後藤", email: "愛 後藤-", status: "withdrawn" },
    { full_name: "柳子 芝山", email: "柳子 芝山-", status: "withdrawn" },
    { full_name: "k-kawabata0624@i.softbank.jp", email: "k-kawabata0624@i.softbank.jp", status: "withdrawn" },
    { full_name: "guan yuan chen", email: "guan yuan chen-", status: "active" }
];

// Step 71 のログから抽出した、上書きしてしまったメールアドレスの復元
const EMAILS_TO_FIX = [
    { full_name: "谷 智代", email: "kazsuz12161015@icloud.com" },
    { full_name: "原 宣子", email: "ushinori@icloud.com" },
    { full_name: "増村 浩気", email: "orehaharapeko@gmail.com" },
    { full_name: "大嶋 美保子", email: "hanacoffee87@yahoo.co.jp" },
    { full_name: "内山 未菜", email: "mina.fagotto@gmail.com" }
];

const DUMMY_HASH = '$2a$10$pxRGAx96PscTf1.C9/qPbu0An56WvXAnv35UuA5SAnAnAnAnAnAnA';
const STORE_1 = '77439c86-679a-409a-8000-2e5297e5c0e8';

async function run() {
    console.log('Restoring database to yesterday\'s state (attempt)...');

    // 1. 新しく作ってしまった「no-email-xxx」ユーザーを削除
    const { data: dummyUsers } = await supabase.from('users').select('id').like('email', 'no-email-%');
    if (dummyUsers && dummyUsers.length > 0) {
        console.log(`Deleting ${dummyUsers.length} dummy users...`);
        await supabase.from('users').delete().in('id', dummyUsers.map(u => u.id));
    }

    // 2. 削除してしまったユーザーを復元
    console.log('Restoring deleted users...');
    for (const u of USERS_TO_RESTORE) {
        const { error } = await supabase.from('users').insert({
            full_name: u.full_name,
            email: u.email,
            status: u.status,
            password_hash: DUMMY_HASH,
            role: 'member',
            store_id: STORE_1 // デフォルト
        });
        if (error) console.error(`  Error restoring ${u.full_name}: ${error.message}`);
    }

    // 3. 上書きしてしまったメールアドレスを復元
    console.log('Fixing overwritten emails...');
    for (const u of EMAILS_TO_FIX) {
        const { error } = await supabase.from('users').update({ email: u.email })
            .eq('full_name', u.full_name);
        if (error) console.error(`  Error fixing email for ${u.full_name}: ${error.message}`);
    }

    console.log('Restore process completed.');
}

run();
