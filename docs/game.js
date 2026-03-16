const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const startButton = document.getElementById("start-button");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const overlayButton = document.getElementById("overlay-button");
const chargeBar = document.getElementById("charge-bar");
const stateText = document.getElementById("state-text");

const width = canvas.width;
const height = canvas.height;
const padding = 72;
const centerX = width * 0.5;
const centerY = height * 0.58;

const state = {
  active: false,
  holding: false,
  charge: 0,
  time: 0,
  lastTick: performance.now(),
  smudgeClock: 0,
  message: "まだ静か",
  messageTimer: 0,
  pointer: {
    x: centerX,
    y: centerY,
    down: false,
  },
  target: {
    x: centerX,
    y: centerY,
  },
  blob: {
    x: centerX,
    y: centerY,
    vx: 0,
    vy: 0,
    tilt: 0,
    scaleX: 1,
    scaleY: 1,
  },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    hold: false,
  },
  smudges: [],
  puffs: [],
  bubbles: [],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function length(x, y) {
  return Math.hypot(x, y);
}

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const size = Math.hypot(x, y);
  if (size < 0.0001) {
    return { x: fallbackX, y: fallbackY };
  }

  return { x: x / size, y: y / size };
}

function pulseDevice(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function setOverlay(title, copy, buttonLabel) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlayButton.textContent = buttonLabel;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function setMessage(message, duration = 0.18) {
  state.message = message;
  state.messageTimer = duration;
}

function updateUi() {
  chargeBar.style.width = `${Math.round(state.charge * 100)}%`;
  stateText.textContent = state.message;
}

function resetBlob() {
  state.target.x = centerX;
  state.target.y = centerY;
  state.pointer.x = centerX;
  state.pointer.y = centerY;
  state.pointer.down = false;
  state.holding = false;
  state.charge = 0;
  state.smudgeClock = 0;
  state.blob.x = centerX;
  state.blob.y = centerY;
  state.blob.vx = 0;
  state.blob.vy = 0;
  state.blob.tilt = 0;
  state.blob.scaleX = 1;
  state.blob.scaleY = 1;
  state.smudges = [];
  state.puffs = [];
  state.bubbles = [];
  setMessage("もどした", 0.4);
  updateUi();
}

function activate() {
  if (state.active) {
    return;
  }

  state.active = true;
  startButton.textContent = "もどす";
  hideOverlay();
  setMessage("さわってる", 0.45);
  updateUi();
}

function ensureActive() {
  if (!state.active) {
    activate();
  }
}

function emitPuffs(x, y, strength) {
  const count = 3 + Math.round(strength * 5);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.22;
    const speed = 20 + Math.random() * 80 + strength * 90;
    state.puffs.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.7,
      radius: 12 + Math.random() * 14 + strength * 10,
      life: 0.22 + Math.random() * 0.18 + strength * 0.1,
      alpha: 0.28 + Math.random() * 0.18,
      color: index % 2 === 0 ? "#fff7ef" : "#f7cfbe",
    });
  }
}

function emitBubbles(x, y, strength) {
  const count = 2 + Math.round(strength * 4);
  for (let index = 0; index < count; index += 1) {
    state.bubbles.push({
      x: x + (Math.random() - 0.5) * 36,
      y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 42,
      vy: -30 - Math.random() * 90 - strength * 80,
      radius: 5 + Math.random() * 8,
      life: 0.45 + Math.random() * 0.3,
      alpha: 0.24 + Math.random() * 0.14,
    });
  }
}

function addSmudge(speed) {
  state.smudges.push({
    x: state.blob.x,
    y: state.blob.y,
    width: 70 + speed * 0.045 + state.charge * 26,
    height: 24 + speed * 0.012 + state.charge * 12,
    angle: state.blob.tilt,
    life: 0.2 + state.charge * 0.18,
    alpha: 0.08 + Math.min(0.1, speed * 0.00008 + state.charge * 0.1),
  });
}

function beginHold() {
  ensureActive();
  state.pointer.down = true;
  state.holding = true;
  setMessage("ためてる", 0.12);
}

function endHold() {
  if (!state.holding) {
    state.pointer.down = false;
    return;
  }

  const stretchX = state.target.x - state.blob.x;
  const stretchY = state.target.y - state.blob.y;
  const direction = normalize(stretchX, stretchY, state.blob.vx, state.blob.vy);
  const stretch = length(stretchX, stretchY);
  const boost = 140 + state.charge * 420 + stretch * 1.25;

  state.blob.vx += direction.x * boost;
  state.blob.vy += direction.y * boost;
  state.pointer.down = false;
  state.holding = false;

  emitPuffs(state.blob.x, state.blob.y, state.charge);
  emitBubbles(state.blob.x, state.blob.y, state.charge);
  pulseDevice(8 + Math.round(state.charge * 10));

  if (state.charge > 0.72) {
    setMessage("ぷにっと強く返った", 0.42);
  } else if (state.charge > 0.32) {
    setMessage("ぷにっと返った", 0.34);
  } else {
    setMessage("軽く返った", 0.24);
  }

  state.charge = 0;
}

function moveTargetTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = width / rect.width;
  const ratioY = height / rect.height;
  state.pointer.x = (clientX - rect.left) * ratioX;
  state.pointer.y = (clientY - rect.top) * ratioY;
  state.target.x = clamp(state.pointer.x, padding, width - padding);
  state.target.y = clamp(state.pointer.y, padding, height - padding);
}

function bounceBounds() {
  const minX = padding;
  const maxX = width - padding;
  const minY = padding;
  const maxY = height - padding;

  if (state.blob.x < minX) {
    state.blob.x = minX;
    if (state.blob.vx < 0) {
      state.blob.vx = -state.blob.vx * 0.52;
      emitPuffs(state.blob.x, state.blob.y, 0.12);
      pulseDevice(4);
    }
  }

  if (state.blob.x > maxX) {
    state.blob.x = maxX;
    if (state.blob.vx > 0) {
      state.blob.vx = -state.blob.vx * 0.52;
      emitPuffs(state.blob.x, state.blob.y, 0.12);
      pulseDevice(4);
    }
  }

  if (state.blob.y < minY) {
    state.blob.y = minY;
    if (state.blob.vy < 0) {
      state.blob.vy = -state.blob.vy * 0.52;
      emitPuffs(state.blob.x, state.blob.y, 0.12);
      pulseDevice(4);
    }
  }

  if (state.blob.y > maxY) {
    state.blob.y = maxY;
    if (state.blob.vy > 0) {
      state.blob.vy = -state.blob.vy * 0.52;
      emitPuffs(state.blob.x, state.blob.y, 0.12);
      pulseDevice(4);
    }
  }
}

function updateMessage(dt, speed) {
  if (state.messageTimer > 0) {
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (state.messageTimer > 0) {
      return;
    }
  }

  if (!state.active) {
    state.message = "まだ静か";
  } else if (state.holding && state.charge > 0.76) {
    state.message = "かなりたまってる";
  } else if (state.holding) {
    state.message = "ためてる";
  } else if (speed > 420) {
    state.message = "するっと流れてる";
  } else if (speed > 150) {
    state.message = "ふわっと戻る";
  } else {
    state.message = "おちついた";
  }
}

function update(dt) {
  state.time += dt;

  if (state.active) {
    const inputX = Number(state.keys.right) - Number(state.keys.left);
    const inputY = Number(state.keys.down) - Number(state.keys.up);
    const inputLength = length(inputX, inputY);

    if (inputLength > 0) {
      const normalizedX = inputX / inputLength;
      const normalizedY = inputY / inputLength;
      state.target.x = clamp(
        state.target.x + normalizedX * 360 * dt,
        padding,
        width - padding,
      );
      state.target.y = clamp(
        state.target.y + normalizedY * 360 * dt,
        padding,
        height - padding,
      );
    }

    if (state.holding || state.keys.hold) {
      state.holding = true;
      state.charge = clamp(state.charge + dt * 1.45, 0, 1);
    } else {
      state.charge = clamp(state.charge - dt * 2.1, 0, 1);
    }

    const spring = state.holding ? 16.5 : 10.6;
    const damping = state.holding ? 8.4 : 9.4;
    const accelerationX =
      (state.target.x - state.blob.x) * spring - state.blob.vx * damping;
    const accelerationY =
      (state.target.y - state.blob.y) * spring - state.blob.vy * damping;

    state.blob.vx += accelerationX * dt;
    state.blob.vy += accelerationY * dt;

    const maxSpeed = 860;
    const speed = length(state.blob.vx, state.blob.vy);
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      state.blob.vx *= ratio;
      state.blob.vy *= ratio;
    }

    state.blob.x += state.blob.vx * dt;
    state.blob.y += state.blob.vy * dt;
    bounceBounds();

    const updatedSpeed = length(state.blob.vx, state.blob.vy);
    const stretch = Math.min(0.18, updatedSpeed * 0.00016);
    const tension = Math.min(
      0.16,
      length(state.target.x - state.blob.x, state.target.y - state.blob.y) *
        0.00022,
    );
    const press = state.holding ? 0.08 + state.charge * 0.18 : 0;

    state.blob.scaleX = damp(
      state.blob.scaleX,
      1 + stretch + tension * 0.5 + press * 0.4,
      12,
      dt,
    );
    state.blob.scaleY = damp(
      state.blob.scaleY,
      1 - stretch * 0.45 - press - tension * 0.2,
      12,
      dt,
    );
    state.blob.tilt = damp(
      state.blob.tilt,
      clamp(state.blob.vx * 0.0011, -0.28, 0.28),
      10,
      dt,
    );

    state.smudgeClock += dt;
    if ((updatedSpeed > 120 || state.holding) && state.smudgeClock >= 0.026) {
      state.smudgeClock = 0;
      addSmudge(updatedSpeed);
    }

    updateMessage(dt, updatedSpeed);
  } else {
    state.blob.scaleX = damp(state.blob.scaleX, 1, 8, dt);
    state.blob.scaleY = damp(state.blob.scaleY, 1, 8, dt);
    state.blob.tilt = damp(state.blob.tilt, 0, 8, dt);
  }

  state.smudges = state.smudges.filter((smudge) => {
    smudge.life -= dt;
    smudge.alpha *= 0.965;
    smudge.width *= 0.99;
    smudge.height *= 0.995;
    return smudge.life > 0.01 && smudge.alpha > 0.01;
  });

  state.puffs = state.puffs.filter((puff) => {
    puff.life -= dt;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= 0.92;
    puff.vy *= 0.92;
    puff.radius += dt * 18;
    puff.alpha *= 0.95;
    return puff.life > 0;
  });

  state.bubbles = state.bubbles.filter((bubble) => {
    bubble.life -= dt;
    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;
    bubble.vx *= 0.95;
    bubble.vy *= 0.95;
    bubble.alpha *= 0.96;
    return bubble.life > 0 && bubble.alpha > 0.01;
  });

  updateUi();
}

function drawBackground(time) {
  context.fillStyle = "#c6e7eb";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255, 255, 255, 0.24)";
  context.fillRect(28, 28, width - 56, height - 56);

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const x = 86 + column * 94 + Math.sin(time * 0.7 + row * 0.8) * 2;
      const y = 92 + row * 68 + Math.cos(time * 0.8 + column * 0.6) * 2;
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.strokeStyle = "rgba(88, 71, 58, 0.08)";
  context.lineWidth = 1;
  for (let row = 0; row < 6; row += 1) {
    const y = 96 + row * 74;
    context.beginPath();
    context.moveTo(76, y);
    context.quadraticCurveTo(width * 0.5, y + 8, width - 76, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(88, 71, 58, 0.12)";
  context.lineWidth = 2;
  context.strokeRect(28, 28, width - 56, height - 56);
}

function drawTarget() {
  const distance = length(
    state.target.x - state.blob.x,
    state.target.y - state.blob.y,
  );

  if (!state.holding && distance < 20) {
    return;
  }

  context.save();
  context.translate(state.target.x, state.target.y);
  context.fillStyle = "rgba(255, 255, 255, 0.46)";
  context.beginPath();
  context.arc(0, 0, 18 + state.charge * 16, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(88, 71, 58, 0.18)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, 18 + state.charge * 16, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawTether() {
  const distance = length(
    state.target.x - state.blob.x,
    state.target.y - state.blob.y,
  );

  if (!state.holding && distance < 18) {
    return;
  }

  context.save();
  context.lineCap = "round";

  context.strokeStyle = "rgba(255, 255, 255, 0.46)";
  context.lineWidth = 18 + state.charge * 16;
  context.beginPath();
  context.moveTo(state.blob.x, state.blob.y);
  context.quadraticCurveTo(
    (state.blob.x + state.target.x) * 0.5,
    (state.blob.y + state.target.y) * 0.5 - 10,
    state.target.x,
    state.target.y,
  );
  context.stroke();

  context.strokeStyle = `rgba(239, 123, 99, ${0.16 + state.charge * 0.18})`;
  context.lineWidth = 8 + state.charge * 10;
  context.beginPath();
  context.moveTo(state.blob.x, state.blob.y);
  context.quadraticCurveTo(
    (state.blob.x + state.target.x) * 0.5,
    (state.blob.y + state.target.y) * 0.5 - 8,
    state.target.x,
    state.target.y,
  );
  context.stroke();
  context.restore();
}

function drawSmudges() {
  state.smudges.forEach((smudge) => {
    context.save();
    context.translate(smudge.x, smudge.y);
    context.rotate(smudge.angle);
    context.fillStyle = `rgba(239, 123, 99, ${smudge.alpha})`;
    context.beginPath();
    context.ellipse(0, 0, smudge.width, smudge.height, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawPuffs() {
  state.puffs.forEach((puff) => {
    context.save();
    context.globalAlpha = puff.alpha;
    context.fillStyle = puff.color;
    context.beginPath();
    context.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawBubbles() {
  state.bubbles.forEach((bubble) => {
    context.save();
    context.globalAlpha = bubble.alpha;
    context.fillStyle = "rgba(255, 255, 255, 0.75)";
    context.beginPath();
    context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(88, 71, 58, 0.12)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawShadow() {
  const speed = length(state.blob.vx, state.blob.vy);
  const widthScale = 58 + speed * 0.03 + state.charge * 24;
  const heightScale = 20 + speed * 0.008 + state.charge * 8;

  context.save();
  context.translate(state.blob.x, state.blob.y + 34);
  context.fillStyle = "rgba(88, 71, 58, 0.14)";
  context.beginPath();
  context.ellipse(0, 0, widthScale, heightScale, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBlob() {
  context.save();
  context.translate(state.blob.x, state.blob.y);
  context.rotate(state.blob.tilt);
  context.scale(state.blob.scaleX, state.blob.scaleY);

  context.fillStyle = "#ef7b63";
  context.beginPath();
  context.moveTo(-72, 0);
  context.bezierCurveTo(-76, -38, -18, -62, 46, -42);
  context.bezierCurveTo(82, -30, 88, 20, 44, 40);
  context.bezierCurveTo(-6, 62, -68, 42, -72, 0);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffd8ca";
  context.beginPath();
  context.moveTo(-34, -16);
  context.bezierCurveTo(-14, -34, 24, -34, 44, -14);
  context.bezierCurveTo(18, -6, -8, -2, -34, -16);
  context.closePath();
  context.fill();

  context.fillStyle = "#fff6ef";
  context.beginPath();
  context.ellipse(-6, -10, 22, 10, -0.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(88, 71, 58, 0.14)";
  context.beginPath();
  context.ellipse(26, 18, 18, 8, -0.18, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(88, 71, 58, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-72, 0);
  context.bezierCurveTo(-76, -38, -18, -62, 46, -42);
  context.bezierCurveTo(82, -30, 88, 20, 44, 40);
  context.bezierCurveTo(-6, 62, -68, 42, -72, 0);
  context.closePath();
  context.stroke();
  context.restore();
}

function draw(timestamp) {
  drawBackground(timestamp / 1000);
  drawSmudges();
  drawPuffs();
  drawBubbles();
  drawTarget();
  drawTether();
  drawShadow();
  drawBlob();
}

function tick(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTick) / 1000);
  state.lastTick = timestamp;
  update(dt);
  draw(timestamp);
  requestAnimationFrame(tick);
}

function startOrReset() {
  if (!state.active) {
    activate();
    return;
  }

  resetBlob();
}

canvas.addEventListener("mousemove", (event) => {
  if (!state.active) {
    return;
  }

  moveTargetTo(event.clientX, event.clientY);
});

canvas.addEventListener("mousedown", (event) => {
  moveTargetTo(event.clientX, event.clientY);
  beginHold();
});

window.addEventListener("mouseup", () => {
  endHold();
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    if (!event.touches[0]) {
      return;
    }

    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
    beginHold();
  },
  { passive: true },
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!event.touches[0]) {
      return;
    }

    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
  },
  { passive: true },
);

window.addEventListener("touchend", () => {
  endHold();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "a"].includes(key)) {
    state.keys.left = true;
    ensureActive();
    event.preventDefault();
  }

  if (["arrowright", "d"].includes(key)) {
    state.keys.right = true;
    ensureActive();
    event.preventDefault();
  }

  if (["arrowup", "w"].includes(key)) {
    state.keys.up = true;
    ensureActive();
    event.preventDefault();
  }

  if (["arrowdown", "s"].includes(key)) {
    state.keys.down = true;
    ensureActive();
    event.preventDefault();
  }

  if (key === " ") {
    state.keys.hold = true;
    beginHold();
    event.preventDefault();
  }

  if (key === "enter" && !state.active) {
    activate();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "a"].includes(key)) {
    state.keys.left = false;
  }

  if (["arrowright", "d"].includes(key)) {
    state.keys.right = false;
  }

  if (["arrowup", "w"].includes(key)) {
    state.keys.up = false;
  }

  if (["arrowdown", "s"].includes(key)) {
    state.keys.down = false;
  }

  if (key === " ") {
    state.keys.hold = false;
    endHold();
    event.preventDefault();
  }
});

startButton.addEventListener("click", startOrReset);
overlayButton.addEventListener("click", startOrReset);

updateUi();
setOverlay(
  "シグナルループ",
  "ぷにっと引いて、離したときの返りだけを見ています。",
  "さわる",
);

requestAnimationFrame((timestamp) => {
  state.lastTick = timestamp;
  draw(timestamp);
  requestAnimationFrame(tick);
});
