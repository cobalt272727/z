// server.js
import express from "express";
import cors from "cors";
import pkg from "pg";
import ContentSafetyClient, { isUnexpected } from "@azure-rest/ai-content-safety";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Magic } from "@magic-sdk/admin";
import dotenv from "dotenv";

// 環境変数を読み込む
dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Magic.link Admin SDK の初期化
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

const app = express();

// CORS設定 - 同一オリジンのみ許可（クロスドメイン非対応）
app.use(cors({
  origin: function (origin, callback) {
    // originがundefinedの場合は同一オリジンからのリクエスト
    if (!origin) {
      return callback(null, true);
    }
    
    // 許可するオリジンのリスト
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'https://z.mcs12.net'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: このオリジンからのアクセスは許可されていません'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Magic.linkトークン検証ミドルウェア
async function verifyMagicToken(req, res, next) {
  try {
    // AuthorizationヘッダーまたはリクエストボディからDIDトークンを取得
    let didToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!didToken && req.body?.didToken) {
      didToken = req.body.didToken;
    }
    
    if (!didToken) {
      return res.status(401).json({ status: "error", message: "認証トークンがありません" });
    }
    
    // Magic Link SDKでトークンを検証
    magic.token.validate(didToken);
    const metadata = await magic.users.getMetadataByToken(didToken);
    
    if (!metadata.email) {
      return res.status(401).json({ status: "error", message: "メールアドレスが取得できません" });
    }
    
    // ドメインチェック
    if (!metadata.email.endsWith('@g.kumamoto-nct.ac.jp')) {
      return res.status(403).json({ status: "error", message: "許可されていないドメインです" });
    }
    
    // リクエストオブジェクトにユーザー情報を追加
    req.userEmail = metadata.email;
    req.userMetadata = metadata;
    
    next();
  } catch (error) {
    console.error("トークン検証エラー:", error);
    return res.status(401).json({ status: "error", message: "認証に失敗しました" });
  }
}

// Azure Content Safety設定
const endpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT;
const key = process.env.AZURE_CONTENT_SAFETY_KEY;
const credential = new AzureKeyCredential(key);
const contentSafetyClient = ContentSafetyClient(endpoint, credential);

// PostgreSQL接続設定
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// NGワードリストをロード
let ngWords = [];
function loadNGWords() {
  try {
    const csvPath = path.join(__dirname, "NGword.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    
    // CSVを行ごとに分割し、空行を除外
    ngWords = csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(word => word.length > 0);
    
    console.log(`NGワードを${ngWords.length}件読み込みました`);
  } catch (error) {
    console.error("NGword.csvの読み込みエラー:", error);
    ngWords = [];
  }
}

// サーバー起動時にNGワードをロード
loadNGWords();

// NGワードチェック関数
function checkNGWords(text) {
  const detectedWords = [];
  
  for (const ngWord of ngWords) {
    if (text.includes(ngWord)) {
      detectedWords.push(ngWord);
    }
  }
  
  return {
    safe: detectedWords.length === 0,
    detectedWords: detectedWords
  };
}

// Azure Content Safetyでテキストをチェックする関数
async function checkContentSafety(text) {
  try {
    const analyzeTextOption = { text: text };
    const analyzeTextParameters = { body: analyzeTextOption };
    
    const result = await contentSafetyClient.path("/text:analyze").post(analyzeTextParameters);
    
    if (isUnexpected(result)) {
      console.error("Content Safety API error:", result);
      return { safe: true, categories: [] }; // エラー時は通過させる
    }
    
    const categories = [];
    let isSafe = true;
    
    for (let i = 0; i < result.body.categoriesAnalysis.length; i++) {
      const analysis = result.body.categoriesAnalysis[i];
      categories.push({
        category: analysis.category,
        severity: analysis.severity
      });
      
      // severity が 1 以上なら unsafe
      if (analysis.severity >= 1) {
        isSafe = false;
      }
    }
    
    return { safe: isSafe, categories: categories };
  } catch (error) {
    console.error("Content Safety check error:", error);
    return { safe: true, categories: [] }; // エラー時は通過させる
  }
}

// ユーザーを登録するAPI
app.post("/register-user", verifyMagicToken, async (req, res) => {
  // 認証済みのメールアドレスを使用
  const email = req.userEmail;

  try {
    // メールアドレスが既に存在するかチェック
    const checkResult = await pool.query("SELECT email FROM userlist WHERE email = $1", [email]);
    
    if (checkResult.rows.length > 0) {
      // 既に登録済み
      res.json({ status: "already_exists", message: "ユーザーは既に登録されています" });
      return;
    }

    // @以前の文字列を取得
    const name = email.split('@')[0];
    
    // 1-5のランダムなアイコン番号を生成
    const icon = Math.floor(Math.random() * 5) + 1;

    // 新規ユーザーを挿入
    await pool.query("INSERT INTO userlist (email, name, icon) VALUES ($1, $2, $3)", [email, name, icon]);
    
    res.json({ status: "success", message: "ユーザー登録が完了しました", name, icon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// ツイート一覧を取得するAPI
app.get("/tweets", verifyMagicToken, async (req, res) => {
  // 認証済みのメールアドレスを使用
  const email = req.userEmail;
  
  try {
    const result = await pool.query(
      "SELECT id, icon, name, message, time, iine FROM tweetlist ORDER BY id DESC LIMIT 100"
    );
    
    // ログイン中のユーザーがいいねしたツイートIDを取得
    const likedResult = await pool.query(
      "SELECT tweet_id FROM iinelist WHERE user_email = $1",
      [email]
    );
    const likedTweetIds = likedResult.rows.map(row => row.tweet_id);
    
    res.json({ 
      status: "success", 
      tweets: result.rows,
      likedTweetIds: likedTweetIds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// メッセージを保存するAPI
app.post("/save", verifyMagicToken, async (req, res) => {
  const { message } = req.body;
  // 認証済みのメールアドレスを使用
  const email = req.userEmail;
  
  try {
    // メールアドレスからuserlistのnameとiconを取得
    const userResult = await pool.query(
      "SELECT name, icon, ban FROM userlist WHERE email = $1",
      [email]
    );


    if (userResult.rows.length === 0) {
      res.status(404).json({ status: "error", message: "ユーザーが見つかりません" });
      return;
    }

    const { name, icon, ban } = userResult.rows[0];
    if (ban) {
      res.status(403).json({ status: "error", message: "あなたのアカウントは管理者によって投稿が制限されています。" });
      return;
    }
    
    // NGワードチェック
    const ngCheck = checkNGWords(message);
    
    if (!ngCheck.safe) {
      console.log("NGワードが検出されました:", ngCheck.detectedWords);
      
      // NGワード検出をデータベースに記録
      try {
        const ngCategories = [{
          category: "NGWord",
          severity: 1,
          detectedWords: ngCheck.detectedWords
        }];
        
        await pool.query(
          "INSERT INTO inappropriate_content_log (user_name, user_email, content, detected_categories) VALUES ($1, $2, $3, $4)",
          [name, email, message, JSON.stringify(ngCategories)]
        );
        console.log("NGワード検出をログに記録しました");
      } catch (logErr) {
        console.error("ログ記録エラー:", logErr);
      }
      
      res.status(400).json({ 
        status: "error", 
        message: "不適切な言葉が含まれているため、投稿できません。",
        detectedWords: ngCheck.detectedWords
      });
      return;
    }
    
    // Azure Content Safetyでコンテンツをチェック
    const safetyCheck = await checkContentSafety(message);
    
    if (!safetyCheck.safe) {
      console.log("不適切なコンテンツが検出されました:");
      
      // 不適切なコンテンツをデータベースに記録
      try {
        await pool.query(
          "INSERT INTO inappropriate_content_log (user_name, user_email, content, detected_categories) VALUES ($1, $2, $3, $4)",
          [name, email, message, JSON.stringify(safetyCheck.categories)]
        );
        console.log("不適切なコンテンツをログに記録しました");
      } catch (logErr) {
        console.error("ログ記録エラー:", logErr);
      }
      
      res.status(400).json({ 
        status: "error", 
        message: "不適切なコンテンツが含まれているため、投稿できません。",
        categories: safetyCheck.categories
      });
      return;
    }
    
    // tweetlistに挿入
    await pool.query(
      "INSERT INTO tweetlist (icon, name, message) VALUES ($1, $2, $3)",
      [icon, name, message]
    );

    // 新しい表示サーバーにメッセージを送信
    try {
      const displayServerUrl = process.env.DISPLAY_SERVER_URL || 'http://localhost:3002';
      const displayResponse = await fetch(`${displayServerUrl}/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, message })
      });
      
      if (displayResponse.ok) {
        console.log("表示サーバーにメッセージを送信しました");
      } else {
        console.warn("表示サーバーへの送信に失敗しました");
      }
    } catch (displayError) {
      console.error("表示サーバーへの送信エラー:", displayError);
      // エラーが発生してもメインの処理は続行
    }

    res.json({ status: "ツイートを送信しました!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "エラーが発生しました" });
  }
});

// いいねを保存するAPI
app.post("/iine", verifyMagicToken, async (req, res) => {
  const { id } = req.body;
  // 認証済みのメールアドレスを使用
  const email = req.userEmail;
  
  try {
    // 既にいいねしているかチェック
    const checkResult = await pool.query(
      "SELECT * FROM iinelist WHERE tweet_id = $1 AND user_email = $2",
      [id, email]
    );

    if (checkResult.rows.length > 0) {
      // 既にいいね済み → いいねを取り消す
      await pool.query(
        "DELETE FROM iinelist WHERE tweet_id = $1 AND user_email = $2",
        [id, email]
      );
      
      await pool.query(
        "UPDATE tweetlist SET iine = iine - 1 WHERE id = $1",
        [id]
      );
      
      res.json({ status: "success", action: "unliked" });
    } else {
      // まだいいねしていない → いいねを追加
      await pool.query(
        "INSERT INTO iinelist (tweet_id, user_email) VALUES ($1, $2)",
        [id, email]
      );
      
      await pool.query(
        "UPDATE tweetlist SET iine = iine + 1 WHERE id = $1",
        [id]
      );
      
      res.json({ status: "success", action: "liked" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
