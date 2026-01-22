#!/bin/bash

echo "🔄 開発サーバーを再起動します..."

# 既存のNext.jsプロセスを停止
echo "📛 既存プロセスを停止中..."
pkill -f "next dev" || true
sleep 2

# キャッシュをクリア
echo "🗑️  キャッシュをクリア中..."
rm -rf .next
rm -rf node_modules/.cache

# 開発サーバーを起動
echo "🚀 開発サーバーを起動中..."
npm run dev

echo "✅ 完了！ http://localhost:3000 でアクセスできます"
