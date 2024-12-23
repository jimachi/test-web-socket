import express from "express";
import { createServer } from "http";
import { join } from "node:path";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  // socket.on("disconnect", () => {
  //   console.log("user disconnected");
  // })
})

const PORT = 3000;
server.listen(PORT, () => {
  console.log("server running at http://localhost:" + PORT);
})