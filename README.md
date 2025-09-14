# Reserve7 - ジム予約システム

段階的に機能を実装するジム予約管理システムです。

## 実装予定の機能

### ① データベース機能（最小）✅
- User: fullName / email(unique) / passwordHash / createdAt
- Reservation: id / clientId(User.id) / title / start / end / notes? / externalEventId? / createdAt
- インデックス例：@@index([clientId, start])
- 運用前提：60分固定（end = start + 60min）

### ② ログイン機能（最小）✅
- 新規登録（会員）：fullName・email・password（PWはbcryptハッシュ保存）
- ログイン/ログアウト
- 権限（簡易）：.env の ADMIN_EMAILS="owner@example.com,staff@example.com" に含まれるメールをジム側（ADMIN）と判定。以外は会員（CLIENT）

### ③ 予約機能（更新後要件）
- 会員（CLIENT）：自分の予約を一覧表示のみ（作成/編集/キャンセルなし）
- ジム側（ADMIN）：全予約の一覧＋予約の作成
- 作成入力：client（既存ユーザー選択：id or email）／title／start（ISO）／notes?
- 仕様：60分固定（end = start + 60min）
- 重複防止：同時刻の重複は拒否（409）

### ④ Googleカレンダー連動（最小）
- 対象：ジム側（ADMIN）が作成した予約のみ自動反映
- 予約作成時：events.insert → 返却 event.id を Reservation.externalEventId に保存
- タイムゾーン：Asia/Tokyo
- カレンダー運用：ジム用カレンダー1つをサービスアカウントに編集権限で共有

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
ADMIN_EMAILS=owner@example.com,staff@example.com

# Google Calendar (Stage 4)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALENDAR_ID=your_gym_calendar_id
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

## 開発の進め方

各段階を順番に実装し、動作確認してから次の段階に進みます：

1. ✅ **Stage ①**: データベース機能の確認
2. ✅ **Stage ②**: 認証機能の実装・テスト
3. **Stage ③**: 予約機能の実装・テスト  
4. **Stage ④**: Googleカレンダー連動の実装・テスト

## 現在の状況

**Stage ② 完了**: 認証システムが実装されました
- ユーザー登録・ログイン・ログアウト機能
- 役割ベースのアクセス制御（CLIENT/ADMIN）
- bcryptによるパスワードハッシュ化
- NextAuth.jsによるセッション管理
