-- 全会員の名前にスペースを追加するSQLスクリプト
-- 管理者（ADMIN）以外の全員（MEMBER）の名前を更新

-- スペースなしの名前を更新
UPDATE users SET full_name = '内山 未菜' WHERE full_name = '内山未菜' AND role = 'MEMBER';
UPDATE users SET full_name = '増村 浩気' WHERE full_name = '増村浩気' AND role = 'MEMBER';
UPDATE users SET full_name = '大場 佳奈' WHERE full_name = '大場佳奈' AND role = 'MEMBER';
UPDATE users SET full_name = '大西 さやか' WHERE full_name = '大西さやか' AND role = 'MEMBER';
UPDATE users SET full_name = '安並 正浩' WHERE full_name = '安並正浩' AND role = 'MEMBER';
UPDATE users SET full_name = '山口 由加里' WHERE full_name = '山口由加里' AND role = 'MEMBER';
UPDATE users SET full_name = '山崎 ジジオ千春' WHERE full_name = '山崎ジジオ千春' AND role = 'MEMBER';
UPDATE users SET full_name = '岡田 千明' WHERE full_name = '岡田千明' AND role = 'MEMBER';
UPDATE users SET full_name = '津田 逸成' WHERE full_name = '津田逸成' AND role = 'MEMBER';
UPDATE users SET full_name = '神津 隼人' WHERE full_name = '神津隼人' AND role = 'MEMBER';
UPDATE users SET full_name = '竹田 星良' WHERE full_name = '竹田星良' AND role = 'MEMBER';
UPDATE users SET full_name = '陳 冠元' WHERE full_name = '陳冠元' AND role = 'MEMBER';
UPDATE users SET full_name = '久保田 奈緒' WHERE full_name = '久保田奈緒' AND role = 'MEMBER';
UPDATE users SET full_name = '東條 成美' WHERE full_name = '東條成美' AND role = 'MEMBER';

-- 全角スペースを半角スペースに変更
UPDATE users SET full_name = '上村 祐太' WHERE full_name = '上村　祐太' AND role = 'MEMBER';
UPDATE users SET full_name = '並木 光' WHERE full_name = '並木　光' AND role = 'MEMBER';
UPDATE users SET full_name = '友野 智子' WHERE full_name = '友野　智子' AND role = 'MEMBER';
UPDATE users SET full_name = '小野 翔太郎' WHERE full_name = '小野　翔太郎' AND role = 'MEMBER';
UPDATE users SET full_name = '常山 順子' WHERE full_name = '常山　順子' AND role = 'MEMBER';
UPDATE users SET full_name = '廣井 結' WHERE full_name = '廣井　結' AND role = 'MEMBER';
UPDATE users SET full_name = '橘木 美穂子' WHERE full_name = '橘木　美穂子' AND role = 'MEMBER';
UPDATE users SET full_name = '浜 克樹' WHERE full_name = '浜　克樹' AND role = 'MEMBER';
UPDATE users SET full_name = '芝山 柳子' WHERE full_name = '芝山　柳子' AND role = 'MEMBER';
UPDATE users SET full_name = '藤尾 美月' WHERE full_name = '藤尾　美月' AND role = 'MEMBER';
UPDATE users SET full_name = '講殿 英俊' WHERE full_name = '講殿　英俊' AND role = 'MEMBER';
UPDATE users SET full_name = '財満 柚里' WHERE full_name = '財満　柚里' AND role = 'MEMBER';
UPDATE users SET full_name = '鍜冶村 忠' WHERE full_name = '鍜冶村　忠' AND role = 'MEMBER';
UPDATE users SET full_name = '齊藤 あきよ' WHERE full_name = '齊藤　あきよ' AND role = 'MEMBER';

-- テストアカウント
UPDATE users SET full_name = '2号店 テスト' WHERE full_name = '2号店テスト' AND role = 'MEMBER';
UPDATE users SET full_name = 'テスト アカウント' WHERE full_name = 'テスト' AND role = 'MEMBER';
UPDATE users SET full_name = '三好 太郎' WHERE full_name = '三好' AND role = 'MEMBER';

-- 確認：スペースなしの会員を検索
SELECT 
  full_name, 
  email,
  CASE 
    WHEN full_name LIKE '% %' THEN '✓ 半角スペースあり'
    WHEN full_name LIKE '%　%' THEN '✗ 全角スペース'
    ELSE '✗ スペースなし'
  END as スペース状態
FROM users 
WHERE role = 'MEMBER'
ORDER BY full_name;
