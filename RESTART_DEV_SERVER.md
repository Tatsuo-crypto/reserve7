# 開発サーバーの再起動手順

## Google Calendar連携が動作しない場合

### ステップ1: 開発サーバーを停止
ターミナルで `Ctrl + C` を押す

### ステップ2: 環境変数を確認
```bash
cat .env.local | grep GOOGLE
```

以下が表示されるはず：
```
GOOGLE_CALENDAR_ID_1=tandjgym@gmail.com
GOOGLE_CALENDAR_ID_2=tandjgym2goutenn@gmail.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### ステップ3: 開発サーバーを再起動
```bash
npm run dev
```

### ステップ4: ログを確認
起動時に以下が表示されるはず：
```
Google Calendar service initialized successfully
```

### ステップ5: 予約を作成
1. 新規予約作成
2. ターミナルのログを確認
3. 以下が表示されるはず：
```
Google Calendar event created: [イベントID]
```

## トラブルシューティング

### エラー: "Google Calendar credentials not configured"
→ 環境変数が読み込まれていません
→ .env.localファイルを確認してください

### エラー: "Failed to initialize Google Calendar service"
→ GOOGLE_SERVICE_ACCOUNT_KEYのJSON形式が間違っています
→ JSONが正しい形式か確認してください

### ログに何も表示されない
→ 予約作成APIが呼ばれていない可能性があります
→ ブラウザのコンソールでエラーを確認してください
