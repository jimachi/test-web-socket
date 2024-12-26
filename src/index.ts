import express from "express";
import { createServer } from "http";
import { join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db: import("sqlite").Database; // グローバルに宣言しておく

(async () => {
  try {
    // DB初期化
    db = await open({
      filename: "chat.db",
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
      );
    `);

    // Express & Socket.io の準備
    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
      connectionStateRecovery: {},
    });

    app.get("/", (req, res) => {
      // __dirname を使う場合、型定義やESモジュール化などに注意
      res.sendFile(join(__dirname, "index.html"));
    });

    io.on("connection", async (socket) => {
      socket.on("chat message", async (msg) => {
        let result;
        try {
          result = await db.run("INSERT INTO messages (content) VALUES (?)", msg);
        } catch (e) {
          console.error(e);
          return;
        }
        io.emit("chat message", msg, result.lastID);
      });

      if (!socket.recovered) {
        try {
          await db.each(
            "SELECT id, content FROM messages WHERE id > ?",
            [socket.handshake.auth.serverOffset || 0],
            (_err, row) => {
              socket.emit("chat message", row.content, row.id);
            }
          );
        } catch (e) {
          console.error(e);
        }
      }
    });

    const PORT = 3000;
    server.listen(PORT, () => {
      console.log("server running at http://localhost:" + PORT);
    });
  } catch (error) {
    console.error("Failed to initialize the application:", error);
  }
})();
