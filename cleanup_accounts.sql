-- データベースアカウント整理スクリプト
-- 既存の予約とユーザーを削除し、指定された4アカウントのみを作成

-- 既存データを削除
DELETE FROM reservations;
DELETE FROM users;

-- 指定されたアカウントを作成
-- 1号店管理者 (パスワード: 30tandjgym30)
INSERT INTO users (full_name, email, password_hash, store_id) VALUES 
('1号店管理者', 'tandjgym@gmail.com', '$2b$12$TAvixg1KXmHUJfbHC3a3Q.uMEFX0PacPb2mXaOo3ifLT2656.Mrn2', 'tandjgym@gmail.com');

-- 2号店管理者 (パスワード: 30tandjgym30)
INSERT INTO users (full_name, email, password_hash, store_id) VALUES 
('2号店管理者', 'tandjgym2goutenn@gmail.com', '$2b$12$TAvixg1KXmHUJfbHC3a3Q.uMEFX0PacPb2mXaOo3ifLT2656.Mrn2', 'tandjgym2goutenn@gmail.com');

-- 1号店会員 (パスワード: member1@example.com)
INSERT INTO users (full_name, email, password_hash, store_id) VALUES 
('1号店会員', 'member1@example.com', '$2b$12$KmYLqY1oDroiqs6dbCKgaOFeR6.wk..T/aGUH4XPpLQZ5bOGvuugC', 'tandjgym@gmail.com');

-- 2号店会員 (パスワード: member2@example.com)
INSERT INTO users (full_name, email, password_hash, store_id) VALUES 
('2号店会員', 'member2@example.com', '$2b$12$aSpoWUVhvGHDGRtUoB.z7uKbelYpTSsiXJaWS1mHdU7hbRx8JISN.', 'tandjgym2goutenn@gmail.com');
