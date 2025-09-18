-- 管理アカウントのパスワードを更新するSQL
-- bcryptでハッシュ化されたパスワード（1111 と 1112）

-- 一号店管理アカウントのパスワードを "1111" に変更
UPDATE users 
SET password_hash = '$2a$12$mxZ2H1HBK6zrVwaRuAf.3efZrudb03d0GZwUKe/eVvqhWeTzY/o/a'
WHERE email = 'tandjgym@gmail.com';

-- 二号店管理アカウントのパスワードを "1112" に変更  
UPDATE users 
SET password_hash = '$2a$12$Wp7ObZg23SENVtDs0xav3ecHZxklEcsKlvNQpNRLAaADUOhPqXTLG'
WHERE email = 'tandjgym2goutenn@gmail.com';

-- 確認用クエリ
-- SELECT email, password_hash FROM users WHERE email IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com');
