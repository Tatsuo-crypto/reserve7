# T&J GYM - ジム予約システム

T&J GYMの複数店舗対応予約管理システムです。

## 機能概要

### 🏪 店舗管理
- 複数店舗対応（1号店・2号店）
- 店舗別データ分離とアクセス制御
- 管理者・会員の権限管理

### 👥 ユーザー管理
- 会員登録・ログイン機能
- 管理者による会員ステータス管理
- セキュアなパスワード管理

### 📅 予約管理
- 直感的な予約作成・編集・キャンセル
- 柔軟なセッション時間設定
- 自動タイトル生成と回数管理
- 店舗別重複防止

### 🗓️ Googleカレンダー連携
- リアルタイム同期
- 店舗別カレンダー管理
- 自動イベント作成・更新・削除

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成：

```bash
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key

# Admin Configuration
ADMIN_EMAILS=tandjgym@gmail.com,tandjgym2goutenn@gmail.com

# Google Calendar Integration
GOOGLE_CALENDAR_ID_1=tandjgym@gmail.com
GOOGLE_CALENDAR_ID_2=tandjgym2goutenn@gmail.com
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_json_key
```

### 3. データベースセットアップ

1. [Supabase](https://supabase.com/)でプロジェクトを作成
2. SQL Editorで `database/schema.sql` を実行
3. 必要に応じて初期データを投入

### 4. アプリケーション起動

```bash
npm run dev
```

http://localhost:3000 でアクセス可能です。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **データベース**: Supabase (PostgreSQL)
- **認証**: NextAuth.js
- **スタイリング**: Tailwind CSS
- **バリデーション**: Zod
- **カレンダー**: Google Calendar API

## アーキテクチャ

### セキュリティ
- bcryptによるパスワードハッシュ化
- NextAuth.jsによるセッション管理
- 店舗別データアクセス制御
- 管理者権限の適切な分離

### データベース設計
- PostgreSQL (Supabase)
- 店舗別データ分離
- リレーショナル設計による整合性保証

### 外部連携
- Google Calendar API
- リアルタイム同期
- エラーハンドリング

## 使用方法

### 管理者機能
1. 管理者アカウントでログイン
2. ダッシュボードから各機能にアクセス
3. 予約管理・会員管理・新規予約作成

### 会員機能
1. 会員アカウントでログイン
2. マイ予約から自分の予約を確認
3. 予約の編集・キャンセルが可能

## ライセンス

このプロジェクトは T&J GYM 専用システムです。
# Force Vercel rebuild
