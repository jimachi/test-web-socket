import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  /* 任意でオプション設定可 */
});

// 通常のHTTP GETリクエスト対応
app.get("/", (req, res) => {
  res.send("Hello from Express + Socket.IO + TypeScript!");
});

// Socket.IO 接続イベント
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // クライアントからのメッセージを受信
  socket.on("chatMessage", (msg) => {
    console.log(`Message from ${socket.id}: ${msg}`);
    // 全クライアントにメッセージをブロードキャスト
    io.emit("chatMessage", msg);
  });

  // 切断
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// サーバー起動
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
