require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkUser() {
  try {
    console.log('Checking user: tandjgym@gmail.com');
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tandjgym@gmail.com')
      .single();

    if (error) {
      console.error('Database error:', error);
      return;
    }

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('✅ User found:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- Full Name:', user.full_name);
    console.log('- Store ID:', user.store_id);
    console.log('- Password Hash exists:', !!user.password_hash);
    console.log('- Password Hash (first 20 chars):', user.password_hash?.substring(0, 20) + '...');

    const testPassword = '30tandjgym30';
    const isValidPassword = await bcrypt.compare(testPassword, user.password_hash);
    console.log('- Password "30tandjgym30" is valid:', isValidPassword);

    // Test other common passwords
    const testPasswords = ['password', 'admin', 'tandjgym', '123456', 'test'];
    for (const pwd of testPasswords) {
      const isValid = await bcrypt.compare(pwd, user.password_hash);
      if (isValid) {
        console.log(`✅ Password "${pwd}" is valid!`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkUser();
