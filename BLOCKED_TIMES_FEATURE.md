# 予約不可時間管理機能 (Blocked Times Management)

## 概要

T&J GYM予約システムに予約不可時間管理機能を追加しました。この機能により、管理者は営業時間外、メンテナンス時間、休業日などの予約不可時間を設定し、その期間中の予約を自動的に防ぐことができます。

## 機能詳細

### 1. 管理者機能

#### ダッシュボード統合
- ダッシュボードに「予約不可時間設定」カードを追加
- 赤色のアイコンとテーマで視覚的に識別可能
- `/admin/blocked-times`ページへの直接リンク

#### 予約不可時間管理ページ (`/admin/blocked-times`)
- 既存のブロック時間一覧表示
- 新規ブロック時間の作成
- 既存ブロック時間の編集・削除
- 繰り返し設定（単発、毎日、毎週、毎月、毎年）
- レスポンシブデザイン対応

#### ブロック時間モーダル (`BlockedTimeModal`)
- 左側：新規作成・編集フォーム
- 右側：既存ブロック時間一覧
- リアルタイム更新
- バリデーション機能

### 2. 予約システム統合

#### 重複チェック機能
- 予約作成時に自動的にブロック時間との重複をチェック
- 重複がある場合、詳細なエラーメッセージを表示
- 例：「この時間帯は予約不可です（メンテナンス）」

#### 店舗別管理
- 1号店（tandjgym@gmail.com）と2号店（tandjgym2goutenn@gmail.com）で独立管理
- 各店舗の管理者は自店舗のブロック時間のみ管理可能

## データベース構造

### blocked_times テーブル

```sql
CREATE TABLE blocked_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'tandjgym@gmail.com',
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' 
        CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
    recurrence_end DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### インデックス
- `idx_blocked_times_calendar_id`: 店舗別フィルタリング用
- `idx_blocked_times_start_time`: 時間範囲検索用
- `idx_blocked_times_time_range`: 重複チェック用

### 制約
- `check_end_after_start`: 終了時刻が開始時刻より後であることを保証
- RLS (Row Level Security): 管理者のみアクセス可能

## API エンドポイント

### GET `/api/blocked-times`
- 管理者認証必須
- 店舗別のブロック時間一覧を取得
- 開始時刻順でソート

### POST `/api/blocked-times`
- 管理者認証必須
- 新規ブロック時間作成
- バリデーション：必須フィールド、時間範囲チェック

### PUT `/api/blocked-times/[id]`
- 管理者認証必須
- 既存ブロック時間の更新
- 店舗所有権チェック

### DELETE `/api/blocked-times/[id]`
- 管理者認証必須
- ブロック時間の削除
- 店舗所有権チェック

## 使用方法

### 1. ブロック時間の設定

1. 管理者でログイン
2. ダッシュボードの「予約不可時間設定」をクリック
3. 「新規設定」ボタンをクリック
4. フォームに必要情報を入力：
   - 開始日時
   - 終了日時
   - 理由（例：メンテナンス、休業日）
   - 繰り返し設定（オプション）
5. 「保存」をクリック

### 2. ブロック時間の編集・削除

1. ブロック時間管理ページで対象の時間を選択
2. モーダル右側の一覧から編集または削除を実行
3. 編集の場合は左側フォームで内容を変更後保存

### 3. 予約作成時の動作

- 管理者が予約を作成する際、システムが自動的にブロック時間をチェック
- 重複がある場合、予約作成が拒否され、理由が表示される
- 予約可能な時間帯のみ予約が作成される

## 技術仕様

### フロントエンド
- **React/Next.js**: メインフレームワーク
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **NextAuth.js**: 認証・認可

### バックエンド
- **Next.js API Routes**: RESTful API
- **Supabase**: データベース・認証
- **Row Level Security**: データアクセス制御

### セキュリティ
- 管理者権限チェック（全エンドポイント）
- 店舗別データ分離
- SQLインジェクション対策
- XSS対策

## エラーハンドリング

### よくあるエラーと対処法

1. **「Admin access required」**
   - 原因：管理者権限がない
   - 対処：管理者アカウントでログインし直す

2. **「この時間帯は予約不可です」**
   - 原因：予約時間がブロック時間と重複
   - 対処：別の時間帯を選択するか、ブロック時間を調整

3. **「End time must be after start time」**
   - 原因：終了時刻が開始時刻より前
   - 対処：正しい時間範囲を入力

## 今後の拡張予定

### Phase 2 機能
- [ ] Google Calendar連携（ブロック時間の同期）
- [ ] 定期的なブロック時間の自動生成
- [ ] ブロック時間のインポート/エクスポート機能
- [ ] 通知機能（ブロック時間設定時の自動通知）

### Phase 3 機能
- [ ] カレンダービューでのブロック時間表示
- [ ] 複数店舗間でのブロック時間共有
- [ ] ブロック時間の統計・レポート機能
- [ ] モバイルアプリ対応

## トラブルシューティング

### データベース関連

```sql
-- ブロック時間テーブルの存在確認
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'blocked_times'
);

-- ブロック時間の確認
SELECT * FROM blocked_times 
WHERE calendar_id = 'tandjgym@gmail.com' 
ORDER BY start_time;
```

### API テスト

```bash
# ブロック時間一覧取得
curl -X GET http://localhost:3000/api/blocked-times \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# ブロック時間作成
curl -X POST http://localhost:3000/api/blocked-times \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "start_time": "2024-01-01T09:00:00Z",
    "end_time": "2024-01-01T17:00:00Z",
    "reason": "年末年始休業"
  }'
```

## 開発者向け情報

### ファイル構成

```
src/
├── app/
│   ├── admin/
│   │   └── blocked-times/
│   │       └── page.tsx          # ブロック時間管理ページ
│   ├── api/
│   │   └── blocked-times/
│   │       ├── route.ts           # GET/POST エンドポイント
│   │       └── [id]/
│   │           └── route.ts       # PUT/DELETE エンドポイント
│   └── dashboard/
│       └── page.tsx               # ダッシュボード（カード追加）
├── components/
│   └── BlockedTimeModal.tsx       # ブロック時間モーダル
└── lib/
    └── auth-utils.ts              # 認証ユーティリティ

database/
└── create_blocked_times_table.sql # テーブル作成スクリプト

scripts/
└── test-blocked-times.js          # テストスクリプト
```

### 環境変数

```env
# 必須
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_EMAILS=tandjgym@gmail.com,tandjgym2goutenn@gmail.com

# オプション（Google Calendar連携用）
GOOGLE_CALENDAR_ID_1=tandjgym@gmail.com
GOOGLE_CALENDAR_ID_2=tandjgym2goutenn@gmail.com
```

## 更新履歴

### v1.0.0 (2024-09-25)
- ✅ 基本的なブロック時間管理機能
- ✅ 管理者専用UI
- ✅ 予約作成時の重複チェック
- ✅ 店舗別データ分離
- ✅ レスポンシブデザイン

---

**開発チーム**: Windsurf AI Assistant  
**最終更新**: 2024年9月25日  
**バージョン**: 1.0.0
