-- 管理アカウント以外の会員データと予約を削除するSQL

-- 1. 予約データを全て削除
DELETE FROM reservations;

-- 2. 管理アカウント以外のユーザーを削除
DELETE FROM users 
WHERE email NOT IN (
    'tandjgym@gmail.com',
    'tandjgym2goutenn@gmail.com'
);

-- 確認用クエリ（実行後に残っているデータを確認）
-- SELECT email, full_name, store_id FROM users;
-- SELECT COUNT(*) as reservation_count FROM reservations;
