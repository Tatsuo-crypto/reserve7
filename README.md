# T&J GYM - ジム予約システム

T&J GYMの複数店舗対応予約管理システムです。

## 実装済み機能

### ✅ データベース機能
- User: fullName / email(unique) / passwordHash / store_id / createdAt
- Reservation: id / clientId(User.id) / title / start / end / notes / calendar_id / externalEventId / createdAt
- 店舗別データ分離対応

### ✅ 認証・権限機能
- 新規登録：fullName・email・password（bcryptハッシュ保存）
- ログイン/ログアウト
- 店舗別アクセス制御：メールアドレスで自動判定
  - `tandjgym@gmail.com` → T&J GYM1号店
  - `tandjgym2goutenn@gmail.com` → T&J GYM2号店
- 管理者権限：ADMIN_EMAILSで設定

### ✅ 予約機能
- 会員（CLIENT）：自店舗の自分の予約のみ表示・編集・キャンセル
- 管理者（ADMIN）：自店舗の全予約の管理・作成
- 柔軟なセッション時間：30分/60分/90分/120分
- 店舗別重複防止
- 自動タイトル生成（クライアント名 + 回数）

### ✅ 複数Googleカレンダー連動
- T&J GYM1号店：`tandjgym@gmail.com`
- T&J GYM2号店：`tandjgym2goutenn@gmail.com`
- 予約作成・更新・削除の自動同期
- タイムゾーン：Asia/Tokyo

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの設定

1. [Supabase](https://supabase.com/)でプロジェクトを作成
2. SQL Editorで `database/schema.sql` を実行
3. プロジェクトの設定からURL・ANON KEYを取得

### 3. 環境変数の設定

`.env.local` ファイルを作成：

```bash
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key

# Admin Emails (comma-separated)
ADMIN_EMAILS=tandjgym@gmail.com,tandjgym2goutenn@gmail.com

# Google Calendar
GOOGLE_CALENDAR_ID_1=tandjgym@gmail.com
GOOGLE_CALENDAR_ID_2=tandjgym2goutenn@gmail.com
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_json_key
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **データベース**: Supabase (PostgreSQL)
- **認証**: NextAuth.js
- **スタイリング**: Tailwind CSS
- **バリデーション**: Zod
- **カレンダー**: Google Calendar API

## プロジェクト構造

```
src/
├── app/                 # Next.js App Router
│   ├── layout.tsx      # ルートレイアウト
│   ├── page.tsx        # ホームページ
│   ├── providers.tsx   # NextAuth プロバイダー
│   ├── globals.css     # グローバルスタイル
│   ├── components/     # 共通コンポーネント
│   │   └── Navigation.tsx
│   ├── api/            # API Routes
│   │   └── auth/       # 認証関連API
│   ├── register/       # 会員登録ページ
│   ├── login/          # ログインページ
│   └── dashboard/      # ダッシュボード
├── lib/                # ユーティリティ・設定
│   ├── types.ts        # TypeScript型定義
│   ├── env.ts          # 環境変数バリデーション
│   ├── supabase.ts     # Supabaseクライアント
│   └── validations.ts  # Zodバリデーションスキーマ
├── types/              # 型定義
│   └── next-auth.d.ts  # NextAuth型拡張
database/
└── schema.sql          # データベーススキーマ
```

## 店舗別アクセス制御

### ログイン方式
- **T&J GYM1号店**: `tandjgym@gmail.com`でログイン
- **T&J GYM2号店**: `tandjgym2goutenn@gmail.com`でログイン

### データ分離
- 各店舗のユーザーは自店舗のデータのみアクセス可能
- 予約作成時は自動的にログイン店舗のカレンダーに作成
- 管理者も店舗別に権限が分離

## システム状況

**全機能実装完了**: T&J GYM複数店舗対応システム
- ✅ ユーザー登録・ログイン・ログアウト
- ✅ 店舗別アクセス制御
- ✅ 予約管理（作成・編集・キャンセル）
- ✅ 複数Googleカレンダー連動
- ✅ 自動タイトル生成・回数管理
