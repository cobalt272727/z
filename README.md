# Z - Twitter風SNSアプリケーション

Magic.linkを使用したパスワードレス認証、Azure AI Content Safetyによるコンテンツモデレーション、PostgreSQLデータベースを使用したTwitter風のSNSアプリケーションです。

## 🚀 セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

#### サーバーサイド (.env)

`.env.example`をコピーして`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
# サーバー設定
PORT=3000
API_BASE_URL=http://localhost:3000

# Magic.link APIキー
MAGIC_SECRET_KEY=your_magic_secret_key_here

# Azure Content Safety
AZURE_CONTENT_SAFETY_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_CONTENT_SAFETY_KEY=your_azure_content_safety_key_here

# PostgreSQL データベース設定
DB_USER=postgres
DB_HOST=your_database_host
DB_DATABASE=your_database_name
DB_PASSWORD=your_database_password
DB_PORT=5432
```

#### クライアントサイド (config.js)

`config.js.example`をコピーして`config.js`ファイルを作成し、以下を設定してください：

```bash
cp config.js.example config.js
```

`config.js`ファイルを編集：

```javascript
window.APP_CONFIG = {
    API_BASE_URL: 'http://localhost:3000',
    MAGIC_PUBLISHABLE_KEY: 'your_magic_publishable_key_here'
};
```

### 3. Magic.link APIキーの取得

1. [Magic.link](https://magic.link/)にアクセスしてアカウント作成
2. ダッシュボードから以下を取得：
   - **Publishable Key** → `config.js`の`MAGIC_PUBLISHABLE_KEY`に設定
   - **Secret Key** → `.env`の`MAGIC_SECRET_KEY`に設定

### 4. Azure Content Safety APIキーの取得

1. [Azure Portal](https://portal.azure.com/)でContent Safetyリソースを作成
2. エンドポイントとキーを取得
3. `.env`の`AZURE_CONTENT_SAFETY_ENDPOINT`と`AZURE_CONTENT_SAFETY_KEY`に設定

### 5. PostgreSQLデータベースのセットアップ

必要なテーブルを作成：

```sql
-- ユーザーテーブル
CREATE TABLE userlist (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100),
    icon INTEGER,
    ban BOOLEAN DEFAULT FALSE
);

-- ツイートテーブル
CREATE TABLE tweetlist (
    id SERIAL PRIMARY KEY,
    icon INTEGER,
    name VARCHAR(100),
    message TEXT,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    iine INTEGER DEFAULT 0
);

-- いいねテーブル
CREATE TABLE iinelist (
    tweet_id INTEGER,
    user_email VARCHAR(255),
    PRIMARY KEY (tweet_id, user_email)
);

-- 不適切コンテンツログテーブル
CREATE TABLE inappropriate_content_log (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(100),
    user_email VARCHAR(255),
    content TEXT,
    detected_categories JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. NGワードCSVファイルの作成

`NGword.csv`ファイルを作成し、禁止ワードを1行に1つずつ記載：

```
禁止ワード1
禁止ワード2
禁止ワード3
```

## 🏃 起動方法

### サーバーの起動

```bash
node server.js
```

### ブラウザでアクセス

```
http://localhost:5500/index.html
```

または、Live Serverなどの開発サーバーを使用してください。

## 📁 ファイル構成

```
.
├── .env                          # サーバー環境変数（Git管理外）
├── .env.example                  # 環境変数のテンプレート
├── config.js                     # クライアント設定（Git管理外）
├── config.js.example             # クライアント設定のテンプレート
├── .gitignore                    # Git除外設定
├── server.js                     # Express.jsサーバー
├── index.html                    # メインHTML
├── auth.js                       # 認証ロジック
├── database.js                   # データベース操作
├── styles.css                    # スタイル
├── NGword.csv                    # NGワードリスト
└── README.md                     # このファイル
```

## 🔒 セキュリティ

- `.env`と`config.js`はGit管理外です（`.gitignore`に追加済み）
- APIキーやデータベース認証情報は絶対にGitにコミットしないでください
- Magic.linkの**Secret Key**はサーバーサイドでのみ使用してください

## ✨ 主な機能

- ✅ Magic.linkによるパスワードレス認証（メールリンク）
- ✅ ドメイン制限（@g.kumamoto-nct.ac.jp のみ）
- ✅ ツイート投稿・表示
- ✅ いいね機能（ユーザーごとに永続化）
- ✅ 2段階コンテンツモデレーション
  - NGワードCSVフィルター（ローカル）
  - Azure AI Content Safety（API）
- ✅ BAN機能（管理者による投稿制限）
- ✅ 不適切コンテンツログ記録

## 🛠️ トラブルシューティング

### サーバーが起動しない

- `.env`ファイルが正しく設定されているか確認
- PostgreSQLデータベースに接続できるか確認
- ポート3000が使用中でないか確認

### ログインできない

- `config.js`の`MAGIC_PUBLISHABLE_KEY`が正しいか確認
- `.env`の`MAGIC_SECRET_KEY`が正しいか確認
- メールドメインが`@g.kumamoto-nct.ac.jp`であるか確認

### コンテンツモデレーションが動作しない

- Azure Content Safetyのエンドポイントとキーが正しいか確認
- `NGword.csv`ファイルが存在するか確認

## 📝 ライセンス

このプロジェクトは教育目的で作成されています。
