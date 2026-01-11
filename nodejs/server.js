// server.js
import express from "express";
import cors from "cors";
import pkg from "pg";
import ContentSafetyClient, { isUnexpected } from "@azure-rest/ai-content-safety";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import PocketBase from "pocketbase";

// 環境変数を読み込む
dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pb = new PocketBase(process.env.POCKETBASE_URL);

try {
  await pb.collection('_superusers').authWithPassword(
    process.env.POCKETBASE_EMAIL,
    process.env.POCKETBASE_PASSWORD,
  );
  console.log("PocketBaseにログインしました");
} catch (error) {
  console.error("PocketBaseログインエラー");
  process.exit(1);
}

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
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:5500',
      'https://z.mcs12.net',
      'https://z.stream.mcs12.net:3021'
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

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ status: 'error', message: '認証が必要です' });
  }
  
  try {
    // ユーザートークン検証用に別のPocketBaseインスタンスを作成
    const userPb = new PocketBase(process.env.POCKETBASE_URL);
    userPb.authStore.save(token);
    const userData = await userPb.collection('users').authRefresh();
    req.user = userData.record;  // 検証済みユーザー情報をreqに保存
    next();
  } catch (error) {
    return res.status(403).json({ status: 'error', message: '無効なトークンです' });
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
app.post("/user-create", async (req, res) => {
  const email = req.body.email;
  try {
    // 先に存在確認
    const existingUser = await pb.collection('users').getList(1, 1, {
      filter: `email="${email}"`
    });
    
    if (existingUser.items.length > 0) {
      // ユーザーが既に存在
      return res.json({ status: "success", user: existingUser.items[0] });
    }
    
    // ユーザーが存在しない場合は新規作成
    console.log("ユーザー新規作成:", email);
    const data = {
      "email": email,
      "emailVisibility": false,
      "password": "12345678",
      "passwordConfirm": "12345678",
      "verify": true
    };
    
    const record = await pb.collection('users').create(data);
    res.json({ status: "success", user: record });
    
  } catch (err) {
    console.error("ユーザー処理エラー:", err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// ユーザーを登録するAPI
app.post("/register-user",authenticateToken, async (req, res) => {
  // 認証済みのメールアドレスを使用
  const email = req.user.email;

  try {
    // メールアドレスが既に存在するかチェック
    const checkResult = await pool.query("SELECT email , icon FROM userlist WHERE email = $1", [email]);
    
    if (checkResult.rows.length > 0) {
      // 既に登録済み
      res.json({ status: "already_exists", message: "ユーザーは既に登録されています",icon: checkResult.rows[0].icon });
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
app.get("/tweets",authenticateToken, async (req, res) => {
  // 認証済みのメールアドレスを使用
  const email = req.user.email;
  const sortType = req.query.sort || 'toukou'; // デフォルトは投稿順
  
  try {
    // ソートタイプに応じてクエリを変更
    let query;
    if (sortType === 'likes') {
      // いいね順（降順）、いいね数が同じ場合は新しい順
      query = "SELECT id, icon, name, message, time, iine FROM tweetlist ORDER BY iine DESC, id DESC LIMIT 100";
    } else {
      // 投稿順（デフォルト）
      query = "SELECT id, icon, name, message, time, iine FROM tweetlist ORDER BY id DESC LIMIT 100";
    }
    
    const result = await pool.query(query);
    
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
app.post("/save", authenticateToken, async (req, res) => {
  const { message } = req.body;
  // 認証済みのメールアドレスを使用
  const email = req.user.email;
  
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

    if(message.length <= 30) {
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
  }

    res.json({ status: "ツイートを送信しました!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "エラーが発生しました" });
  }
});

// いいねを保存するAPI
app.post("/iine", authenticateToken, async (req, res) => {
  const { id } = req.body;
  // 認証済みのメールアドレスを使用
  const email = req.user.email;
  
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

// 自分のツイート一覧を取得するAPI
app.get("/my-tweets", authenticateToken, async (req, res) => {
  const email = req.user.email;
  try {
    const result = await pool.query(
      "SELECT id, icon, name, message, time, iine FROM tweetlist WHERE name = (SELECT name FROM userlist WHERE email = $1) ORDER BY id DESC",
      [email]
    );

    res.json({ 
      status: "success", 
      tweets: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// いいねしたユーザー一覧を取得するAPI
app.get("/iine-users/:tweetId", authenticateToken, async (req, res) => {
  const { tweetId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT u.name, u.icon 
       FROM iinelist i 
       JOIN userlist u ON i.user_email = u.email 
       WHERE i.tweet_id = $1 
       ORDER BY i.id DESC`,
      [tweetId]
    );
    
    res.json({ 
      status: "success", 
      users: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "エラーが発生しました" });
  }
});

// ツイートを削除するAPI
app.delete("/tweets/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const email = req.user.email;
  
  try {
    // 自分のツイートかチェック
    const tweetResult = await pool.query(
      "SELECT * FROM tweetlist WHERE id = $1 AND name = (SELECT name FROM userlist WHERE email = $2)",
      [id, email]
    );
    
    if (tweetResult.rows.length === 0) {
      return res.status(403).json({ status: "error", message: "このツイートを削除する権限がありません" });
    }
    
    const tweet = tweetResult.rows[0];
    
    // 削除前にdeleted_tweetテーブルに保存
    await pool.query(
      "INSERT INTO deleted_tweet (original_tweet_id, icon, name, message, original_time, deleted_by) VALUES ($1, $2, $3, $4, $5, $6)",
      [tweet.id, tweet.icon, tweet.name, tweet.message, tweet.time, email]
    );
    
    // いいねを削除
    await pool.query("DELETE FROM iinelist WHERE tweet_id = $1", [id]);
    
    // ツイートを削除
    await pool.query("DELETE FROM tweetlist WHERE id = $1", [id]);
    
    res.json({ status: "success", message: "ツイートを削除しました" });
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

process.on("SIGINT", async () => {
  console.log("サーバーを終了します...");
  pb.authStore.clear();
  process.exit(0);
});