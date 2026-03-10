const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {};
let playerCount = 0;

io.on("connection", (socket) => {
  playerCount++;
  let playerName = "Player " + playerCount;

  console.log(playerName + " connected:", socket.id);

  users[socket.id] = {
    id: socket.id,
    name: playerName,

    // 鼠标位置
    x: 300,
    y: 200,
    px: 300,
    py: 200,
    energy: 0,

    // 视觉参数
    hueValue: Math.floor(Math.random() * 360),
    seedValue: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
    breathSpeed: 0.7 + Math.random() * 0.9,
    wobbleAmount: 0.6 + Math.random() * 1.2,
    stretchX: 0.8 + Math.random() * 0.8,
    stretchY: 0.8 + Math.random() * 0.8,
    dropletCount: 5 + Math.floor(Math.random() * 5),
    enterAnim: Math.floor(Math.random() * 4),
    startTime: Date.now()
  };

  // 发给当前用户
  socket.emit("init", {
    myId: socket.id,
    users: users
  });

  // 通知所有人：新玩家加入
  io.emit("userJoined", {
    id: socket.id,
    phrase: playerName + " joined",
    user: users[socket.id]
  });

  // 接收鼠标数据
  socket.on("mouseData", (data) => {
    if (!users[socket.id]) return;

    users[socket.id].px = users[socket.id].x;
    users[socket.id].py = users[socket.id].y;
    users[socket.id].x = data.x;
    users[socket.id].y = data.y;
    users[socket.id].energy = data.energy;

    io.emit("usersUpdate", users);
  });

  // 玩家离开
  socket.on("disconnect", () => {
    if (!users[socket.id]) return;

    console.log(users[socket.id].name + " disconnected:", socket.id);

    io.emit("userLeft", {
      id: socket.id,
      phrase: users[socket.id].name + " left"
    });

    delete users[socket.id];

    io.emit("usersUpdate", users);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});