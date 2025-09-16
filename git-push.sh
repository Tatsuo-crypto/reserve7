#!/bin/bash

# Check git status
echo "Checking git status..."
git status

# Add all changes
echo "Adding changes..."
git add .

# Commit changes
echo "Committing changes..."
git commit -m "feat: Update login page UI

- Change title from 'ログイン' to 'T&J GYM'
- Add subtitle '予約確認フォーム' 
- Remove 'または新規登録はこちら' text
- Simplify login page layout"

# Push to repository
echo "Pushing to repository..."
git push origin feature/new-features

echo "Push completed!"
