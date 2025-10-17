# T&J GYM 予約管理システム 仕様書

**バージョン:** 1.0.0  
**最終更新日:** 2025年10月17日  
**システム名:** T&J GYM Reservation System

---

## 📋 目次

1. [システム概要](#システム概要)
2. [ユーザーロール](#ユーザーロール)
3. [機能一覧](#機能一覧)
4. [画面構成](#画面構成)
5. [API仕様](#api仕様)
6. [データベース設計](#データベース設計)
7. [認証・認可](#認証認可)
8. [技術スタック](#技術スタック)
9. [デプロイ環境](#デプロイ環境)

---

## システム概要

### システムの目的
T&J GYMの予約管理、会員管理、売上管理を一元化し、効率的な店舗運営を支援する。

### 対象店舗
- **1号店:** tandjgym@gmail.com
- **2号店:** tandjgym2goutenn@gmail.com

### 主要機能
- 予約管理（カレンダー表示）
- 会員管理（CRUD操作）
- 売上管理（プラン別集計）
- トレーナー管理
- 店舗管理

---

## ユーザーロール

### 1. 管理者（ADMIN）
**アクセス権限:** 全機能

**管理者アカウント:**
- 1号店: `tandjgym@gmail.com` / パスワード: `1111`
- 2号店: `tandjgym2goutenn@gmail.com` / パスワード: `1112`

**アクセス可能な機能:**
- ✅ 予約管理
- ✅ 会員管理
- ✅ 売上管理
- ✅ トレーナー管理
- ✅ 店舗管理

**アクセスURL:**
```
https://reserve7.vercel.app/dashboard
```

---

### 2. トレーナー
**アクセス権限:** 限定機能

**アクセス可能な機能:**
- ✅ 予約管理（カレンダー）
- ✅ 会員管理
- ❌ 売上管理（非表示）
- ❌ トレーナー管理（非表示）
- ❌ 店舗管理（非表示）

**アクセスURL:**
```
https://reserve7.vercel.app/trainer/{トレーナーToken}
```

**トレーナーToken:**
- 各トレーナーに固有のUUIDが発行される
- URLに含めることでアクセス制御を実現

---

## 機能一覧

### 1. 予約管理

#### カレンダー表示
- **パス:** `/admin/calendar`
- **機能:**
  - 月単位のカレンダー表示
  - 予約の作成・編集・削除
  - 予約不可時間の設定
  - 店舗別フィルタリング
  - トレーナー別フィルタリング

#### 予約情報
- **表示項目:**
  - 日付・時間
  - 会員名
  - プラン（月2回、月4回、月6回、月8回、ダイエットコース、カウンセリング）
  - ステータス（予約済み、キャンセル済み）

---

### 2. 会員管理

#### 会員一覧
- **パス:** `/admin/members`
- **機能:**
  - 会員の検索・絞り込み
  - ステータス別表示（在籍、休会、退会）
  - プラン別ソート
  - 専用URL（アクセストークン）のコピー

#### 会員情報（CRUD）
- **作成:**
  - 苗字・名前（分離入力）
  - メールアドレス
  - プラン選択
  - 月額料金
  - 店舗選択（1号店/2号店）
  - ステータス（在籍/休会/退会）
  - メモ

- **編集:**
  - プラン変更
  - ステータス変更
  - メモ更新

- **削除:**
  - 確認モーダル表示
  - 論理削除

#### トラッキング機能
- 会員の予約履歴を確認
- 利用回数の把握

---

### 3. 売上管理

#### プラン別サマリー
- **パス:** `/admin/sales`
- **機能:**
  - プラン別の会員数表示
  - 月額料金の合計
  - 店舗別フィルタリング（全店舗/1号店/2号店）

#### 表示項目
- プラン名（月2回、月4回、月6回、月8回、ダイエットコース、カウンセリング）
- 会員数
- 合計金額（¥表示）

#### 店舗フィルター
- **全店舗:** 両店舗のデータを統合表示
- **1号店:** 1号店のデータのみ表示
- **2号店:** 2号店のデータのみ表示

---

### 4. トレーナー管理

#### トレーナー一覧
- **パス:** `/admin/trainers`
- **機能:**
  - トレーナーの追加・編集・削除
  - トレーナーToken管理
  - 店舗割り当て

#### トレーナー専用URL
- **生成ロジック:**
  - 固有のUUID（トレーナーToken）を発行
  - URLパラメータで認証
  - アクセス制限機能（予約・会員管理のみ）

**URL形式:**
```
https://reserve7.vercel.app/trainer/{UUID}
```

---

### 5. 店舗管理

#### 店舗情報
- **パス:** `/admin/stores`
- **管理項目:**
  - 店舗名
  - 店舗ID（メールアドレス）
  - 管理者情報

---

## 画面構成

### 管理者ダッシュボード

```
/dashboard
├── 予約管理カード → /admin/calendar
├── 会員管理カード → /admin/members
├── 売上管理カード → /admin/sales
├── トレーナー管理カード → /admin/trainers
└── 店舗管理カード → /admin/stores
```

---

### トレーナーダッシュボード

```
/trainer/{token}
├── 予約管理カード → /admin/calendar?trainerToken={token}
└── 会員管理カード → /admin/members?trainerToken={token}
```

**注意:** 売上管理、トレーナー管理、店舗管理はトレーナーには表示されない

---

## API仕様

### 認証API

#### ログイン
```
POST /api/auth/signin
```

**リクエスト:**
```json
{
  "email": "tandjgym@gmail.com",
  "password": "1111"
}
```

**レスポンス:**
```json
{
  "user": {
    "email": "tandjgym@gmail.com",
    "role": "ADMIN",
    "storeId": "tandjgym@gmail.com"
  }
}
```

---

#### トレーナーToken認証
```
GET /api/auth/trainer-token?token={UUID}
```

**レスポンス:**
```json
{
  "trainer": {
    "id": "xxx-xxx-xxx",
    "name": "三井達雄",
    "email": "trainer@example.com",
    "storeId": "tandjgym@gmail.com"
  }
}
```

---

### 会員管理API

#### 会員一覧取得
```
GET /api/admin/members
GET /api/admin/members?all_stores=true
```

**クエリパラメータ:**
- `all_stores` (boolean): 全店舗データ取得（管理者のみ）

**レスポンス:**
```json
{
  "data": {
    "members": [
      {
        "id": "xxx-xxx-xxx",
        "full_name": "大嶋 美保子",
        "email": "example@example.com",
        "plan": "月2回",
        "status": "active",
        "store_id": "tandjgym@gmail.com",
        "monthly_fee": 13200,
        "created_at": "2025-01-01T00:00:00Z",
        "memo": "備考",
        "access_token": "xxx-xxx-xxx",
        "stores": {
          "id": "tandjgym@gmail.com",
          "name": "T&J GYM【1号店】"
        }
      }
    ]
  }
}
```

---

#### 会員作成
```
POST /api/admin/members
```

**リクエスト:**
```json
{
  "fullName": "山田 太郎",
  "email": "yamada@example.com",
  "plan": "月4回",
  "status": "active",
  "storeId": "tandjgym@gmail.com",
  "monthlyFee": 20000,
  "memo": "備考"
}
```

---

#### 会員更新
```
PATCH /api/admin/members
```

**リクエスト:**
```json
{
  "memberId": "xxx-xxx-xxx",
  "status": "suspended",
  "plan": "月6回",
  "memo": "更新された備考"
}
```

---

#### 会員削除
```
DELETE /api/admin/members
```

**リクエスト:**
```json
{
  "memberId": "xxx-xxx-xxx"
}
```

---

### 予約管理API

#### 予約一覧取得
```
GET /api/reservations
```

**レスポンス:**
```json
{
  "reservations": [
    {
      "id": "xxx-xxx-xxx",
      "date": "2025-09-23",
      "start_time": "09:00",
      "end_time": "10:00",
      "client_id": "xxx-xxx-xxx",
      "calendar_id": "primary",
      "event_id": "xxx",
      "created_at": "2025-09-01T00:00:00Z"
    }
  ]
}
```

---

### 予約不可時間API

#### 予約不可時間の管理
**実装方法:** 予約不可時間は通常の予約として管理される
- `client_id = null` の予約が「予約不可時間」
- 予約テーブル（`reservations`）で一元管理

---

### 売上管理API

#### プラン別売上集計
```
GET /api/admin/sales
```

**注意:** 現在は会員管理APIのデータをフロントエンドで集計

---

## データベース設計

### テーブル構成

#### users（会員・管理者）
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  plan TEXT,
  status TEXT DEFAULT 'active', -- active, suspended, withdrawn
  store_id TEXT NOT NULL,
  monthly_fee INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  memo TEXT,
  access_token UUID DEFAULT uuid_generate_v4()
);
```

**インデックス:**
- `email`（ログイン用）
- `store_id`（店舗フィルタリング用）
- `status`（ステータスフィルタリング用）

---

#### stores（店舗）
```sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY, -- メールアドレス
  name TEXT NOT NULL
);
```

**データ:**
```sql
INSERT INTO stores VALUES
  ('tandjgym@gmail.com', 'T&J GYM【1号店】'),
  ('tandjgym2goutenn@gmail.com', 'T&J GYM【2号店】');
```

---

#### reservations（予約）
```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  event_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**特記事項:**
- `client_id = NULL` の場合、「予約不可時間」として扱う
- Google Calendarとの連携用に`event_id`を保持

---

#### trainers（トレーナー）
```sql
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  store_id TEXT REFERENCES stores(id),
  token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### RLS（Row Level Security）

#### users テーブル
```sql
-- 管理者は全データアクセス可能
CREATE POLICY admin_all ON users
  FOR ALL
  USING (
    auth.jwt() ->> 'email' IN ('tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com')
  );

-- トレーナーは自店舗のデータのみアクセス可能
CREATE POLICY trainer_store ON users
  FOR SELECT
  USING (
    store_id = (auth.jwt() ->> 'email')
  );
```

---

## 認証・認可

### NextAuth.js

#### 認証プロバイダー
- **Credentials Provider:** メールアドレス・パスワード認証

#### セッション管理
- **戦略:** JWT
- **有効期限:** 30日

#### ロール管理
```typescript
interface User {
  email: string;
  role: 'ADMIN' | 'TRAINER';
  storeId: string;
  isAdmin: boolean;
}
```

---

### アクセス制御

#### 管理者ページ
```typescript
// ミドルウェアで認証チェック
if (session?.user?.role !== 'ADMIN') {
  redirect('/login');
}
```

#### トレーナーページ
```typescript
// URLパラメータでToken認証
const token = searchParams.get('trainerToken');
const trainer = await verifyTrainerToken(token);
```

---

## 技術スタック

### フロントエンド
- **フレームワーク:** Next.js 14 (App Router)
- **言語:** TypeScript
- **スタイリング:** Tailwind CSS
- **UI コンポーネント:** shadcn/ui
- **状態管理:** React Hooks
- **認証:** NextAuth.js v4

### バックエンド
- **API:** Next.js API Routes
- **データベース:** Supabase (PostgreSQL)
- **ORM:** Supabase Client

### インフラ
- **ホスティング:** Vercel
- **データベース:** Supabase Cloud
- **バージョン管理:** Git (GitHub)

---

## デプロイ環境

### 本番環境

**URL:** https://reserve7.vercel.app

**環境変数:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://zxbaskjxujwitbjznijn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXTAUTH_SECRET=<32文字以上のランダム文字列>
NEXTAUTH_URL=https://reserve7.vercel.app
ADMIN_EMAILS=tandjgym@gmail.com,tandjgym2goutenn@gmail.com
```

---

### 開発環境

**URL:** http://localhost:3000

**起動コマンド:**
```bash
npm run dev
```

**環境変数:**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://zxbaskjxujwitbjznijn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXTAUTH_SECRET=<開発用シークレット>
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAILS=tandjgym@gmail.com,tandjgym2goutenn@gmail.com
```

---

## セキュリティ対策

### 認証
- ✅ パスワードハッシュ化（bcrypt）
- ✅ JWTトークン（有効期限付き）
- ✅ セッション管理（NextAuth.js）

### 認可
- ✅ ロールベースアクセス制御（RBAC）
- ✅ Row Level Security（RLS）
- ✅ APIエンドポイントでの権限チェック

### データ保護
- ✅ 環境変数による機密情報管理
- ✅ HTTPS通信（Vercel自動対応）
- ✅ CORS設定

---

## パフォーマンス最適化

### フロントエンド
- ✅ Next.js App Routerによるサーバーコンポーネント活用
- ✅ 画像最適化（Next.js Image）
- ✅ コード分割（Dynamic Import）

### バックエンド
- ✅ データベースインデックス
- ✅ APIレスポンスキャッシュ
- ✅ 効率的なクエリ設計

---

## 今後の拡張予定

### 機能追加候補
- [ ] メール通知機能
- [ ] LINE通知連携
- [ ] 会員向けマイページ
- [ ] 予約リマインダー
- [ ] 統計ダッシュボード
- [ ] レポート出力機能
- [ ] モバイルアプリ対応

### 改善項目
- [ ] レスポンシブデザインの強化
- [ ] アクセシビリティ対応
- [ ] テスト自動化
- [ ] エラーハンドリング強化

---

## サポート・お問い合わせ

**開発者:** Cascade AI Assistant  
**システム管理者:** T&J GYM  
**最終更新日:** 2025年10月17日

---

## 変更履歴

### v1.0.0 (2025-10-17)
- 初版リリース
- 予約管理機能実装
- 会員管理機能実装
- 売上管理機能実装
- トレーナー専用URL実装
- 店舗別フィルタリング実装
