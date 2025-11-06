// display-server.js - WebSocketサーバー専用
import { WebSocketServer } from "ws";
import express from "express";

const app = express();
app.use(express.json());

// WebSocketサーバーを作成
const PORT = process.env.DISPLAY_PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocketサーバーが起動しました: ws://localhost:${PORT}`);
console.log(`display.htmlを開いて、WebSocket接続先を ws://localhost:${PORT} に設定してください`);

// WebSocket接続を管理
wss.on("connection", (ws) => {
  console.log("新しいクライアントが接続しました");
  console.log(`現在の接続数: ${wss.clients.size}`);
  
  ws.on("close", () => {
    console.log("クライアントが切断しました");
    console.log(`現在の接続数: ${wss.clients.size}`);
  });
  
  ws.on("error", (error) => {
    console.error("WebSocketエラー:", error);
  });
});

// メッセージをすべての接続クライアントにブロードキャスト
export function broadcastMessage(message) {
  const messageData = JSON.stringify(message);
  let successCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageData);
      successCount++;
    }
  });
  
  console.log(`メッセージを ${successCount} 個のクライアントに送信しました`);
}

// HTTPサーバーでブロードキャストエンドポイントを提供
const HTTP_PORT = process.env.DISPLAY_HTTP_PORT || 3002;
app.post("/broadcast", (req, res) => {
  const { name, message } = req.body;
  
  console.log(`新しいメッセージを受信: ${name} - ${message}`);
  
  // すべてのWebSocketクライアントにブロードキャスト
  broadcastMessage({ name, message });
  
  res.json({ status: "success", clients: wss.clients.size });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTPエンドポイント起動: http://localhost:${HTTP_PORT}`);
  console.log(`ブロードキャストURL: http://localhost:${HTTP_PORT}/broadcast`);
});
