const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {};

function randomHue() {
  return Math.floor(Math.random() * 360);
}

function randomPhrase() {
  const phrases = [
    "A new presence enters",
    "Another body joins",
    "Someone leaves a trace",
    "The interface expands",
    "A new movement begins"
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

users[socket.id] = {
  id: socket.id,
  x: 300,
  y: 200,
  px: 300,
  py: 200,
  energy: 0,

  // 基础视觉
  hue: randomHue(),
  type: Math.floor(Math.random() * 4),

  // 个体差异参数
  seed: Math.random() * 1000,
  phase: Math.random() * Math.PI * 2,
  breathSpeed: 0.7 + Math.random() * 0.9,
  wobbleAmount: 0.6 + Math.random() * 1.2,
  stretchX: 0.8 + Math.random() * 0.8,
  stretchY: 0.8 + Math.random() * 0.8,
  dropletCount: 5 + Math.floor(Math.random() * 5),

  // 进入动画：0=expand, 1=slideX, 2=slideY, 3=twist
  enterAnim: Math.floor(Math.random() * 4),
  joinedAt: Date.now()
};

  socket.emit("init", {
    myId: socket.id,
    users: users
  });

  io.emit("userJoined", {
    id: socket.id,
    phrase: randomPhrase(),
    user: users[socket.id]
  });

  socket.on("mouseData", (data) => {
    if (!users[socket.id]) return;

    users[socket.id].px = users[socket.id].x;
    users[socket.id].py = users[socket.id].y;
    users[socket.id].x = data.x;
    users[socket.id].y = data.y;
    users[socket.id].energy = data.energy;

    io.emit("usersUpdate", users);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete users[socket.id];

    io.emit("userLeft", {
      id: socket.id,
      phrase: "A presence fades"
    });

    io.emit("usersUpdate", users);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});