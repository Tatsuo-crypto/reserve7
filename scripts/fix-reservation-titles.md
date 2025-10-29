# 予約タイトルの一括修正手順

## 問題
RLS有効化後、予約タイトルのカウントが正しく機能していませんでした。
- 例: 山口14 → 山口1/4（誤）

## 修正完了
コードは修正済みです。新規予約は正しいタイトルで作成されます。

## 既存予約の修正方法

### 方法1: ブラウザのDevToolsから実行（推奨）

1. **予約管理ページ**を開く
2. **F12**でDevToolsを開く
3. **Console**タブを選択
4. 以下のコードを貼り付けて実行：

```javascript
// 山口さんの予約タイトルを修正
async function fixTitles() {
  // 1. 山口さんのIDを取得
  const membersRes = await fetch('/api/admin/members');
  const membersData = await membersRes.json();
  const members = membersData.data?.members || membersData.members || [];
  
  // 山口さんを検索（名前で検索）
  const yamaguchi = members.find(m => m.full_name?.includes('山口'));
  
  if (!yamaguchi) {
    console.error('山口さんが見つかりません');
    return;
  }
  
  console.log('山口さんのID:', yamaguchi.id);
  console.log('プラン:', yamaguchi.plan);
  
  // 2. タイトルを一括更新
  const response = await fetch('/api/admin/reservations/refresh-titles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: yamaguchi.id })
  });
  
  const result = await response.json();
  console.log('結果:', result);
  
  if (response.ok) {
    console.log('✅ 予約タイトルの修正が完了しました！');
    console.log('ページをリロードして確認してください');
  } else {
    console.error('❌ エラー:', result.error);
  }
}

fixTitles();
```

### 方法2: すべての会員の予約を一括修正

```javascript
// すべての会員の予約タイトルを修正
async function fixAllTitles() {
  const membersRes = await fetch('/api/admin/members');
  const membersData = await membersRes.json();
  const members = membersData.data?.members || membersData.members || [];
  
  console.log(`${members.length}名の会員を処理します...`);
  
  for (const member of members) {
    console.log(`処理中: ${member.full_name}...`);
    
    const response = await fetch('/api/admin/reservations/refresh-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: member.id })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${member.full_name} 完了`);
    } else {
      console.error(`❌ ${member.full_name} エラー:`, result.error);
    }
    
    // 負荷軽減のため500ms待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('✅ すべての会員の処理が完了しました！');
  console.log('ページをリロードして確認してください');
}

fixAllTitles();
```

## 修正内容

### Before（RLS有効化後）
```
予約タイトル生成時:
1. supabase（anonキー）で既存予約を取得
2. RLSで取得失敗 → 既存予約0件と判断
3. 常に "山口1/4" になる ❌
```

### After（修正後）
```
予約タイトル生成時:
1. supabaseAdmin（管理者キー）で既存予約を取得
2. 正しく全予約を取得 ✅
3. 累積カウント: "山口14" ✅
4. 月次カウント: "山口1/4", "山口2/4"... ✅
```

## 動作確認

1. **山口さんの予約を作成**
   - 正しいカウントで表示される（例: 山口14）

2. **既存予約の確認**
   - 予約一覧で修正されたタイトルを確認
   - Googleカレンダーでも更新される

## 注意事項

- **新規予約は自動的に正しいタイトルで作成されます**
- **既存予約は上記スクリプトで一括修正が必要です**
- **Googleカレンダーのイベントも自動更新されます**
