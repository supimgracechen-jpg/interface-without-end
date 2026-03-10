let socket;
let myId = null;
let users = {};

let t = 0;
let message = "";
let messageAlpha = 0;

function setup() {
  createCanvas(min(windowWidth * 0.95, 1200), min(windowHeight * 0.9, 700));
  colorMode(HSB, 360, 100, 100, 100);
  noFill();

  socket = io();

  socket.on("init", (data) => {
    myId = data.myId;
    users = data.users;
  });

  socket.on("usersUpdate", (serverUsers) => {
    users = serverUsers;
  });

  socket.on("userJoined", (data) => {
    showMessage(data.phrase || "Player joined");
  });

  socket.on("userLeft", (data) => {
    showMessage(data.phrase || "Player left");
  });
}

function draw() {
  background(0, 80, 25, 16);

  // 鼠标数据给server
  if (socket && myId) {
    let speed = dist(mouseX, mouseY, pmouseX, pmouseY);
    let myEnergy = speed * 0.05;

    socket.emit("mouseData", {
      x: mouseX,
      y: mouseY,
      energy: myEnergy
    });
  }

  // 画所有在线玩家
  for (let id in users) {
    drawPlayer(users[id], id === myId);
  }

  drawBottomInstruction();
  drawTopMessage();
  drawOnlineCount();

  t += 0.02;
}

function drawPlayer(user, isMe) {
  let dx = user.x - user.px;
  let dy = user.y - user.py;
  let speed = dist(user.x, user.y, user.px, user.py);

  let localT = t * user.breathSpeed + user.phase;
  let boostedEnergy = (user.energy || 0) * 3.5;

  // 原始位置
  let baseCx = width / 2 + map(user.x, 0, width, -260, 260);
  let baseCy = height / 2 + map(user.y, 0, height, -180, 180);

  //拉扯/挤压
  let shifted = applyCollectiveForces(user, baseCx, baseCy);

  let cx = shifted.x;
  let cy = shifted.y;

  let appear = constrain((millis() - user.startTime) / 1200, 0, 1);
  let enter = applyEnterAnimation(user.enterAnim, appear, cx, cy);

  push();
  translate(enter.x, enter.y);
  rotate(enter.rot);
  scale(enter.scale);

  let currentType = getMovementType(dx, dy, speed);

  if (currentType === "horizontal") {
    drawHorizontalShape(user, localT, boostedEnergy, isMe);
  } else if (currentType === "vertical") {
    drawVerticalShape(user, localT, boostedEnergy, isMe);
  } else if (currentType === "diagonal1") {
    rotate(PI / 4);
    drawHorizontalShape(user, localT, boostedEnergy, isMe);
  } else if (currentType === "diagonal2") {
    rotate(-PI / 4);
    drawHorizontalShape(user, localT, boostedEnergy, isMe);
  } else if (currentType === "petal") {
    drawPetalShape(user, localT, boostedEnergy, isMe);
    drawDroplets(user, localT, appear);
  } else if (currentType === "messy") {
    drawMessyTraceShape(user, localT, boostedEnergy, isMe);
  } else {
    drawOrbitShape(user, localT, boostedEnergy, isMe);
  }

  pop();
}

// 被拉扯/被挤的核心
function applyCollectiveForces(user, baseCx, baseCy) {
  let x = baseCx;
  let y = baseCy;

  let pullX = 0;
  let pullY = 0;
  let pushX = 0;
  let pushY = 0;

  let selfScreenX = baseCx;
  let selfScreenY = baseCy;

  let count = 0;

  for (let id in users) {
    let other = users[id];
    if (other.id === user.id) continue;

    let otherCx = width / 2 + map(other.x, 0, width, -260, 260);
    let otherCy = height / 2 + map(other.y, 0, height, -180, 180);

    let vx = otherCx - selfScreenX;
    let vy = otherCy - selfScreenY;
    let d = dist(selfScreenX, selfScreenY, otherCx, otherCy);

    if (d < 0.001) continue;

    // 轻微拉向群体中心
    pullX += vx * 0.01;
    pullY += vy * 0.01;

    // 距离近的时候互相挤开
    if (d < 220) {
      let force = map(d, 0, 220, 18, 0);
      pushX -= (vx / d) * force;
      pushY -= (vy / d) * force;
    }

    count++;
  }

  // 合并效果
  x += pullX + pushX;
  y += pullY + pushY;

  return { x, y };
}

function getMovementType(dx, dy, speed) {
  let absDx = abs(dx);
  let absDy = abs(dy);

  // 更容易切换
  if (speed > 12) return "messy";
  if (absDx > absDy * 1.4) return "horizontal";
  if (absDy > absDx * 1.4) return "vertical";
  if (dx * dy > 0 && speed > 2) return "diagonal1";
  if (dx * dy < 0 && speed > 2) return "diagonal2";
  if (speed > 1) return "petal";

  return "orbit";
}

function applyEnterAnimation(enterAnim, appear, cx, cy) {
  let eased = easeOutCubic(appear);

  let x = cx;
  let y = cy;
  let rot = 0;
  let scale = eased;

  if (enterAnim === 0) {
    scale = eased;
  } else if (enterAnim === 1) {
    x = lerp(cx - 120, cx, eased);
    scale = 0.4 + eased * 0.6;
  } else if (enterAnim === 2) {
    y = lerp(cy - 100, cy, eased);
    scale = 0.4 + eased * 0.6;
  } else if (enterAnim === 3) {
    rot = lerp(-0.8, 0, eased);
    scale = 0.3 + eased * 0.7;
  }

  return { x, y, rot, scale };
}

function easeOutCubic(x) {
  return 1 - pow(1 - x, 3);
}

function drawBottomInstruction() {
  noStroke();
  fill(0, 0, 100, 100);
  textAlign(CENTER, CENTER);
  textSize(20);
  text("Move your mouse in different directions and speeds :3", width / 2, height - 40);
  noFill();
}

function drawTopMessage() {
  if (messageAlpha > 0) {
    noStroke();
    fill(0, 0, 100, messageAlpha);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(message, width / 2, 35);
    messageAlpha -= 1.5;
  }
}

// 新增：实时在线人数
function drawOnlineCount() {
  let count = Object.keys(users).length;

  noStroke();
  fill(0, 0, 100, 85);
  textAlign(LEFT, TOP);
  textSize(16);
  text("Players online: " + count, 20, 20);
  noFill();
}

function getDynamicStroke(user, energyValue, alphaValue = 90) {
  let dynamicHue = (user.hueValue + sin(t * 1.5) * 120 + energyValue * 200) % 360;
  stroke(dynamicHue, 90, 100, alphaValue);
}

// 1. orbit
function drawOrbitShape(user, localT, energyValue, isMe) {
  let baseR = 75 + sin(localT) * 12 + energyValue * 30;

  getDynamicStroke(user, energyValue, isMe ? 95 : 75);
  strokeWeight(isMe ? 3.5 : 3);
  noFill();

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.08) {
    let n = noise(
      cos(angle) * 0.8 + user.seedValue,
      sin(angle) * 0.8 + user.seedValue,
      localT
    );
    let offset = map(n, 0, 1, -18, 18) * user.wobbleAmount;

    let x = cos(angle) * (baseR + offset) * user.stretchX;
    let y = sin(angle) * (baseR + offset) * user.stretchY;

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

// 2. horizontal
function drawHorizontalShape(user, localT, energyValue, isMe) {
  let rx = (120 + sin(localT * 1.3) * 18 + energyValue * 50) * 1.4;
  let ry = (26 + cos(localT) * 6 + energyValue * 8) * 0.7;

  getDynamicStroke(user, energyValue, isMe ? 95 : 75);
  strokeWeight(isMe ? 3.5 : 3);
  noFill();

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.08) {
    let n = noise(cos(angle) + user.seedValue, sin(angle) + user.seedValue, localT * 0.9);
    let offset = map(n, 0, 1, -18, 18);

    let x = cos(angle) * (rx + offset);
    let y = sin(angle) * (ry + offset * 0.15);

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

// 3. vertical
function drawVerticalShape(user, localT, energyValue, isMe) {
  let rx = (26 + cos(localT) * 6 + energyValue * 8) * 0.7;
  let ry = (120 + sin(localT * 1.3) * 18 + energyValue * 50) * 1.4;

  getDynamicStroke(user, energyValue, isMe ? 95 : 75);
  strokeWeight(isMe ? 3.5 : 3);
  noFill();

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.08) {
    let n = noise(cos(angle) + user.seedValue, sin(angle) + user.seedValue, localT * 0.9);
    let offset = map(n, 0, 1, -18, 18);

    let x = cos(angle) * (rx + offset * 0.15);
    let y = sin(angle) * (ry + offset);

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

// 4. petal
function drawPetalShape(user, localT, energyValue, isMe) {
  let baseR = 68 + sin(localT) * 10 + energyValue * 20;

  getDynamicStroke(user, energyValue, isMe ? 95 : 78);
  strokeWeight(isMe ? 3.5 : 3);
  noFill();

  let petalCount = 4 + floor(user.seedValue % 3);

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.06) {
    let petal = sin(angle * petalCount + localT) * (24 + user.wobbleAmount * 8);
    let wobble = map(
      noise(cos(angle) + user.seedValue, sin(angle) + user.seedValue, localT),
      0, 1, -10, 10
    );

    let r = baseR + petal + wobble;

    let x = cos(angle) * r * user.stretchX;
    let y = sin(angle) * r * user.stretchY;

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

function drawDroplets(user, localT, appear) {
  let dynamicHue = (user.hueValue + cos(t * 2) * 80) % 360;
  stroke(dynamicHue, 80, 100, 60);
  strokeWeight(1.8);
  noFill();

  let outerR = 112 + sin(localT) * 10;

  for (let i = 0; i < user.dropletCount; i++) {
    let a = map(i, 0, user.dropletCount, 0, TWO_PI);
    let dx = cos(a) * outerR;
    let dy = sin(a) * outerR;

    push();
    translate(dx, dy);
    rotate(a + sin(localT + i) * 0.2);
    scale(0.4 + appear * 0.6);
    drawSingleDroplet(8 + sin(localT + i) * 2 + user.wobbleAmount * 2);
    pop();
  }
}

function drawSingleDroplet(s) {
  beginShape();
  vertex(0, -s);
  bezierVertex(s * 0.8, -s * 0.4, s * 0.8, s * 0.7, 0, s);
  bezierVertex(-s * 0.8, s * 0.7, -s * 0.8, -s * 0.4, 0, -s);
  endShape(CLOSE);
}

// 5. messy
function drawMessyTraceShape(user, localT, energyValue, isMe) {
  getDynamicStroke(user, energyValue, isMe ? 80 : 65);
  strokeWeight(isMe ? 2.6 : 2.2);
  noFill();

  let layers = 2 + floor(user.seedValue % 2);

  for (let layer = 0; layer < layers; layer++) {
    beginShape();
    for (let angle = 0; angle < TWO_PI; angle += 0.12) {
      let r =
        65 +
        sin(angle * (2 + layer) + localT * 1.4) * (30 + energyValue * 25) +
        noise(
          user.seedValue + layer * 30 + cos(angle),
          user.seedValue + layer * 30 + sin(angle),
          localT
        ) * (38 + user.wobbleAmount * 12);

      let x = cos(angle + layer * 0.3) * r * 0.7 * user.stretchX;
      let y = sin(angle + layer * 0.5) * r * 0.7 * user.stretchY;

      curveVertex(x, y);
    }
    endShape(CLOSE);
  }
}

function showMessage(newMessage) {
  message = newMessage;
  messageAlpha = 100;
}

function windowResized() {
  resizeCanvas(min(windowWidth * 0.95, 1200), min(windowHeight * 0.9, 700));
}