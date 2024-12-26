import express from "express";
import { createServer } from "http";
import { join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { availableParallelism } from "node:os";
import cluster from "node:cluster";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";

let db: import("sqlite").Database;

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

    if (cluster.isPrimary) {
      const numCPUs = availableParallelism();
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
          PORT: 3000 + i,
        });
      }

      setupPrimary();
    } else {
      const app = express();
      const server = createServer(app);
      const io = new Server(server, {
        connectionStateRecovery: {},
        adapter: createAdapter(),
      });

      app.get("/", (req, res) => {
        res.sendFile(join(__dirname, "index.html"));
      });

      io.on("connection", async (socket) => {
        socket.on("chat message", async (msg, clientOffset, callback) => {
          let result;
          try {
            result = await db.run("INSERT INTO messages (content, client_offset) VALUES (?, ?)", msg, clientOffset);
          } catch (e: any) {
            if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
              callback();
            } else {
              console.error(e);
            }
            return;
          }
          io.emit("chat message", msg, result.lastID);
          callback();
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

      const PORT = process.env.PORT;
      server.listen(PORT, () => {
        console.log(`server running at http://localhost:${PORT}`);
      });
    }
  } catch (error) {
    console.error("Failed to initialize the application:", error);
  }
})();
