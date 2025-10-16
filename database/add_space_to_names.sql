-- 会員名にスペースを追加するSQLスクリプト
-- 実際の会員データに基づいて、苗字と名前の間にスペースを挿入

-- 原　宣子
UPDATE users SET full_name = '原 宣子' WHERE full_name = '原　宣子';

-- 大嶋美保子
UPDATE users SET full_name = '大嶋 美保子' WHERE full_name = '大嶋美保子';

-- 竹田里良
UPDATE users SET full_name = '竹田 里良' WHERE full_name = '竹田里良';

-- 荒谷彰子
UPDATE users SET full_name = '荒谷 彰子' WHERE full_name = '荒谷彰子';

-- 谷智代
UPDATE users SET full_name = '谷 智代' WHERE full_name = '谷智代';

-- 確認用クエリ
SELECT id, full_name, email FROM users WHERE email NOT LIKE '%@gmail.com' ORDER BY full_name;
