# 3種類のユーザータイプ実装計画

## 概要
T&J GYM予約システムに3種類のユーザータイプを実装します。

### ユーザータイプ

| タイプ | 認証方法 | アクセス可能な機能 |
|--------|----------|-------------------|
| **管理者（ADMIN）** | ログイン（30日間有効） | 予約管理、会員管理、売上管理、店舗管理、権限管理 |
| **アルバイト（STAFF）** | トークンURL | 予約管理、会員管理 |
| **会員（CLIENT）** | トークンURL | 自身の予約確認のみ（新規予約不可） |

---

## 実装ステップ

### ✅ ステップ1: データベース更新
- [x] `add_role_system.sql`を作成
- [ ] Supabaseで実行
- [ ] roleカラム追加（ADMIN, STAFF, CLIENT）
- [ ] access_tokenカラム追加
- [ ] 既存管理者をADMINに更新

### ⏳ ステップ2: 認証システム更新
- [ ] `auth-config.ts`にセッション期限30日を設定
- [ ] 管理者のログイン機能を維持
- [ ] トークンベース認証の実装

### ⏳ ステップ3: アルバイト用ページ作成
- [ ] `/staff/[token]/` ディレクトリ作成
- [ ] 予約管理ページ
- [ ] 会員管理ページ
- [ ] ナビゲーション制限（売上・店舗・権限は非表示）

### ⏳ ステップ4: 会員ページ更新
- [ ] 既存の `/client/[token]/` を更新
- [ ] 新規予約機能を無効化（表示のみ）
- [ ] UIを「予約確認」に変更

### ⏳ ステップ5: 権限チェック機能
- [ ] `lib/permissions.ts` 作成
- [ ] ページごとの権限チェック
- [ ] APIエンドポイントの権限チェック

### ⏳ ステップ6: 管理画面更新
- [ ] アルバイトアカウント作成機能
- [ ] アルバイト用URL生成
- [ ] 権限管理ページ作成

---

## ファイル構成

```
src/
├── app/
│   ├── admin/          # 管理者専用（ログイン必要）
│   │   ├── members/    # 会員管理
│   │   ├── reservations/ # 予約管理
│   │   ├── sales/      # 売上管理（NEW）
│   │   ├── stores/     # 店舗管理
│   │   └── permissions/ # 権限管理（NEW）
│   ├── staff/          # アルバイト用（トークンURL）
│   │   └── [token]/
│   │       ├── members/    # 会員管理
│   │       └── reservations/ # 予約管理
│   └── client/         # 会員用（トークンURL）
│       └── [token]/
│           └── page.tsx # 予約確認のみ
├── lib/
│   ├── auth-config.ts  # 管理者ログイン設定
│   ├── permissions.ts  # 権限チェック（NEW）
│   └── auth-utils.ts   # 認証ユーティリティ
└── database/
    └── add_role_system.sql # データベース更新
```

---

## データベーススキーマ

### users テーブル

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- ADMINのみ必須
    role VARCHAR(20) DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'STAFF', 'CLIENT')),
    access_token UUID DEFAULT uuid_generate_v4(),  -- STAFF, CLIENT用
    store_id VARCHAR(50),
    plan VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    monthly_fee INTEGER DEFAULT 0,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 次のステップ

1. **データベース更新を実行**
   ```bash
   # Supabaseダッシュボードで add_role_system.sql を実行
   ```

2. **auth-config.tsを更新**（セッション30日）

3. **アルバイト用ページを作成**

4. **会員ページを更新**（新規予約不可）

5. **テスト実施**

---

## 注意事項

- 既存の会員データは自動的にCLIENT roleになります
- 管理者アカウント（tandjgym@gmail.com, tandjgym2goutenn@gmail.com）は自動的にADMINになります
- アルバイトは管理画面からアカウント作成時に設定します
