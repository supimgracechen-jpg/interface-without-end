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
    showMessage(data.phrase);
  });

  socket.on("userLeft", (data) => {
    showMessage(data.phrase);
  });
}

function draw() {
  background(0, 80, 25, 16);

  if (socket && myId) {
    let speed = dist(mouseX, mouseY, pmouseX, pmouseY);
    let myEnergy = speed * 0.012;

    socket.emit("mouseData", {
      x: mouseX,
      y: mouseY,
      energy: myEnergy
    });
  }

  for (let id in users) {
    drawUserShape(users[id], id === myId);
  }

  if (messageAlpha > 0) {
    noStroke();
    fill(0, 0, 100, messageAlpha);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(message, width / 2, 34);
    messageAlpha -= 1.5;
  }

  noStroke();
fill(0, 0, 100, 90);
textAlign(CENTER, CENTER);
textSize(24);
text("Move your mouse quickly.", width / 2, height - 40);
noFill();

  t += 0.02;
}

function drawUserShape(user, isMe) {
  let localT = t * user.breathSpeed + user.phase;
  let energy = user.energy || 0;

  let baseCx = width / 2 + map(user.x, 0, width, -90, 90);
  let baseCy = height / 2 + map(user.y, 0, height, -70, 70);

  // 进入动画进度：0~1
  let appear = constrain((millis() - (user.joinedAt || millis())) / 1200, 0, 1);
  let enter = applyEnterAnimation(user, appear, baseCx, baseCy);

  push();
  translate(enter.x, enter.y);
  rotate(enter.rot);
  scale(enter.scale);

  if (user.type === 0) {
    drawOrbitShape(user, localT, energy, isMe);
  } else if (user.type === 1) {
    drawHorizontalStretchShape(user, localT, energy, isMe);
  } else if (user.type === 2) {
    drawPetalShape(user, localT, energy, isMe);
    drawDroplets(user, localT, appear);
  } else if (user.type === 3) {
    drawMessyTraceShape(user, localT, energy, isMe);
  }

  pop();
}

function applyEnterAnimation(user, appear, cx, cy) {
  let eased = easeOutCubic(appear);

  let x = cx;
  let y = cy;
  let rot = 0;
  let scale = eased;

  if (user.enterAnim === 0) {
    // 从小到大绽开
    scale = eased;
  } else if (user.enterAnim === 1) {
    // 横向滑入
    x = lerp(cx - 120, cx, eased);
    scale = 0.4 + eased * 0.6;
  } else if (user.enterAnim === 2) {
    // 竖向滑入
    y = lerp(cy - 100, cy, eased);
    scale = 0.4 + eased * 0.6;
  } else if (user.enterAnim === 3) {
    // 扭转进入
    rot = lerp(-0.8, 0, eased);
    scale = 0.3 + eased * 0.7;
  }

  return { x, y, rot, scale };
}

function easeOutCubic(x) {
  return 1 - pow(1 - x, 3);
}

//
// 1. 呼吸圆环型
//
function drawOrbitShape(user, localT, energy, isMe) {
  let baseR = 75 + sin(localT) * 12 + energy * 35;

  stroke(user.hue, 80, 95, isMe ? 95 : 72);
  strokeWeight(isMe ? 2.4 : 1.8);
  noFill();

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.08) {
    let n = noise(
      cos(angle) * 0.8 + user.seed,
      sin(angle) * 0.8 + user.seed,
      localT
    );
    let offset = map(n, 0, 1, -18, 18) * user.wobbleAmount;

    let x = cos(angle) * (baseR + offset) * user.stretchX;
    let y = sin(angle) * (baseR + offset) * user.stretchY;

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

//
// 2. 横向拉伸型
//
function drawHorizontalStretchShape(user, localT, energy, isMe) {
  let rx = (110 + sin(localT * 1.3) * 18 + energy * 55) * user.stretchX;
  let ry = (24 + cos(localT) * 8 + energy * 10) * user.stretchY;

  stroke(user.hue, 80, 95, isMe ? 95 : 72);
  strokeWeight(isMe ? 2.4 : 1.8);
  noFill();

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.08) {
    let n = noise(
      cos(angle) + user.seed,
      sin(angle) + user.seed,
      localT * 0.9
    );
    let offset = map(n, 0, 1, -20, 20) * user.wobbleAmount;

    let x = cos(angle) * (rx + offset);
    let y = sin(angle) * (ry + offset * 0.18);

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

//
// 3. 花瓣型
//
function drawPetalShape(user, localT, energy, isMe) {
  let baseR = 68 + sin(localT) * 10 + energy * 25;

  stroke(user.hue, 80, 95, isMe ? 95 : 75);
  strokeWeight(isMe ? 2.4 : 1.8);
  noFill();

  let petalCount = 4 + floor((user.seed % 3)); // 4~6

  beginShape();
  for (let angle = 0; angle < TWO_PI; angle += 0.06) {
    let petal = sin(angle * petalCount + localT) * (24 + user.wobbleAmount * 8);
    let wobble = map(
      noise(cos(angle) + user.seed, sin(angle) + user.seed, localT),
      0, 1, -10, 10
    );

    let r = baseR + petal + wobble;

    let x = cos(angle) * r * user.stretchX;
    let y = sin(angle) * r * user.stretchY;

    curveVertex(x, y);
  }
  endShape(CLOSE);
}

//
// 花瓣周围的小水滴
//
function drawDroplets(user, localT, appear) {
  stroke(user.hue, 70, 95, 55);
  strokeWeight(1.5);
  noFill();

  let count = user.dropletCount || 6;
  let outerR = 112 + sin(localT) * 10;

  for (let i = 0; i < count; i++) {
    let a = map(i, 0, count, 0, TWO_PI);
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

//
// 4. messy / unstable trace
//
function drawMessyTraceShape(user, localT, energy, isMe) {
  stroke(user.hue, 80, 95, isMe ? 90 : 62);
  strokeWeight(isMe ? 2.2 : 1.6);
  noFill();

  let layers = 2 + floor((user.seed % 2)); // 2 or 3

  for (let layer = 0; layer < layers; layer++) {
    beginShape();
    for (let angle = 0; angle < TWO_PI; angle += 0.12) {
      let r =
        65 +
        sin(angle * (2 + layer) + localT * 1.4) * (30 + energy * 25) +
        noise(
          user.seed + layer * 30 + cos(angle),
          user.seed + layer * 30 + sin(angle),
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