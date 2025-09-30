#!/bin/bash

echo "🚀 Pushing refactor/bigbang branch to GitHub..."

# Check current branch
current_branch=$(git branch --show-current)
echo "Current branch: $current_branch"

if [ "$current_branch" != "refactor/bigbang" ]; then
    echo "❌ Error: Not on refactor/bigbang branch"
    exit 1
fi

# Check git status
echo "📋 Checking git status..."
git status

# Push the branch to origin
echo "📤 Pushing refactor/bigbang to origin..."
git push -u origin refactor/bigbang

echo "✅ Push completed!"
echo "🔗 Branch available at: https://github.com/Tatsuo-crypto/reserve7/tree/refactor/bigbang"
