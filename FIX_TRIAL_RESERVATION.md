# 体験予約エラーの修正方法

## 問題
体験予約を作成しようとすると、データベースの制約違反エラーが発生します：
```
new row for relation "reservations" violates check constraint "check_blocked_reservation"
```

## 原因
`reservations`テーブルに設定されている`check_blocked_reservation`制約が、`client_id`がNULLの場合、titleに「予約不可」が含まれている必要があります。しかし、体験予約は「体験」という文字を含むため、制約に違反しています。

## 修正方法

### Supabaseで以下のSQLを実行してください：

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. 以下のSQLを実行：

```sql
-- Drop the old constraint
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS check_blocked_reservation;

-- Add new constraint that allows trial reservations
ALTER TABLE reservations ADD CONSTRAINT check_blocked_reservation 
CHECK (
  (client_id IS NOT NULL) OR 
  (client_id IS NULL AND (title LIKE '%予約不可%' OR title LIKE '%体験%'))
);
```

### 実行後
制約が更新され、以下の予約タイプがすべて作成可能になります：
- ✅ 通常予約（client_idあり）
- ✅ 予約不可時間（client_idなし、titleに「予約不可」）
- ✅ 体験予約（client_idなし、titleに「体験」）

## 確認方法
SQLを実行後、体験予約を作成してみてください。正常に作成できるはずです。
