# T&J GYM アプリ

管理者・トレーナー・会員向けの、予約・会員・売上・カルテ・ダイエットサポート管理アプリです。Next.js、TypeScript、Supabase、NextAuth.jsを使用し、Vercelで運用しています。

このZIPはソースコード一式です。会員データや実際の接続キーは別途管理します。元の版は `SOURCE_VERSION` で確認できます。

## 起動

Node.jsとnpmが必要です。GitHubの検証環境はNode.js 20で設定されています。

1. 依存関係をインストールします。

   ```bash
   npm ci
   ```

2. `.env.example` を基に `.env.local` を用意し、利用するSupabase・認証・外部サービスの値を設定します。必須なのはSupabase接続情報、認証用シークレット、管理者メールアドレスです。実際のキーをGitへ登録しないでください。

3. 開発サーバーを起動します。

   ```bash
   npm run dev
   ```

   [ローカル画面](http://localhost:3000)を開きます。

既存の運用環境に接続する場合、データベースを作り直す必要はありません。新しいデータベースを使う場合は、`database/` の初期定義と `supabase/migrations/` の適用状況を確認して準備してください。SQLには既存データを更新する処理もあるため、一括で再実行しないでください。

## フォルダー

| 場所 | 用途 |
| --- | --- |
| `src/app/` | 各画面とAPI |
| `src/components/` | 共通の画面部品 |
| `src/lib/`・`src/hooks/` | 共通処理 |
| `public/` | 使用中の画像・アイコン |
| `supabase/migrations/` | データベースの追加変更 |
| `database/` | 初期定義・旧版のスキーマ変更 |
| `scripts/`・`tests/` | 開発用コマンド・自動テスト |
| `docs/` | ZIPの構成・運用手順 |

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番用ビルド |
| `npm run start` | ビルド済みアプリの起動 |
| `npm run typecheck` | 型チェック |
| `npm run lint` | コード検証 |
| `npm run test:membership` | 契約・売上管理の検証 |
| `npm run archive:source` | Gitに保存済みの版から整理済みZIPを作成 |

画面操作の自動テストには起動中のローカルサーバーとPlaywrightのブラウザーが必要です。最初に `npx playwright install chromium` を実行します。別ポートで起動した場合は `PLAYWRIGHT_BASE_URL` で接続先を指定できます。

## 案内

- [ZIPの内容と除外対象](docs/ARCHIVE_CONTENTS.md)
- [契約・月会費の管理](docs/CONTRACT_MANAGEMENT.md)
- [Googleカレンダーの設定](GOOGLE_CALENDAR_SETUP.md)

T&J GYM専用システムです。
