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
const stagePadding = 58;

const state = {
  active: false,
  time: 0,
  lastTick: performance.now(),
  charge: 0,
  charging: false,
  ribbonClock: 0,
  messageTimer: 0,
  message: "まだ静か",
  target: {
    x: width * 0.5,
    y: height * 0.56,
  },
  core: {
    x: width * 0.5,
    y: height * 0.56,
    vx: 0,
    vy: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  },
  camera: {
    x: 0,
    y: 0,
    trauma: 0,
  },
  aim: {
    x: 1,
    y: 0,
  },
  pointer: {
    down: false,
    moved: false,
  },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    charge: false,
  },
  ribbons: [],
  sparks: [],
  rings: [],
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

function setOverlay(title, copy, buttonLabel) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlayButton.textContent = buttonLabel;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function setMessage(message, duration = 0.16) {
  state.message = message;
  state.messageTimer = duration;
}

function updateUi() {
  chargeBar.style.width = `${Math.round(state.charge * 100)}%`;
  stateText.textContent = state.message;
}

function centerTarget() {
  state.target.x = width * 0.5;
  state.target.y = height * 0.56;
}

function resetMotion() {
  centerTarget();
  state.core.x = state.target.x;
  state.core.y = state.target.y;
  state.core.vx = 0;
  state.core.vy = 0;
  state.core.rotation = 0;
  state.core.scaleX = 1;
  state.core.scaleY = 1;
  state.charge = 0;
  state.charging = false;
  state.pointer.down = false;
  state.camera.x = 0;
  state.camera.y = 0;
  state.camera.trauma = 0;
  state.ribbons = [];
  state.sparks = [];
  state.rings = [];
  setMessage("整えた", 0.45);
  updateUi();
}

function activateInteraction() {
  if (state.active) {
    return;
  }

  state.active = true;
  startButton.textContent = "整える";
  hideOverlay();
  setMessage("触れている", 0.45);
  updateUi();
}

function ensureActive() {
  if (!state.active) {
    activateInteraction();
  }
}

function spawnRing(x, y, strength) {
  state.rings.push({
    x,
    y,
    radius: 14 + strength * 20,
    width: 2.4 + strength * 2.2,
    life: 0.55 + strength * 0.26,
    alpha: 0.28 + strength * 0.32,
  });
}

function spawnSparks(x, y, directionX, directionY, amount, strength) {
  for (let index = 0; index < amount; index += 1) {
    const angle =
      Math.atan2(directionY, directionX) +
      (Math.random() - 0.5) * (0.9 + (1 - strength) * 1.1);
    const speed = 160 + Math.random() * 340 + strength * 260;

    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 10 + Math.random() * 28 + strength * 20,
      life: 0.18 + Math.random() * 0.24 + strength * 0.2,
      alpha: 0.28 + Math.random() * 0.32,
    });
  }
}

function pulse(strength) {
  const direction = normalize(
    state.target.x - state.core.x,
    state.target.y - state.core.y,
    state.aim.x,
    state.aim.y,
  );

  state.aim.x = direction.x;
  state.aim.y = direction.y;

  const impulse = 240 + strength * 780;
  state.core.vx += direction.x * impulse;
  state.core.vy += direction.y * impulse;
  state.camera.trauma = clamp(
    state.camera.trauma + 0.18 + strength * 0.42,
    0,
    1,
  );

  spawnRing(state.core.x, state.core.y, strength);
  spawnRing(
    state.core.x - direction.x * 8,
    state.core.y - direction.y * 8,
    strength * 0.6,
  );
  spawnSparks(
    state.core.x,
    state.core.y,
    direction.x,
    direction.y,
    12 + Math.round(strength * 18),
    strength,
  );

  if (strength > 0.82) {
    setMessage("強く弾いた", 0.46);
  } else if (strength > 0.42) {
    setMessage("弾いた", 0.34);
  } else {
    setMessage("軽く弾いた", 0.24);
  }
}

function beginCharge() {
  ensureActive();
  state.pointer.down = true;
  state.charging = true;
  setMessage("ためている", 0.12);
}

function endCharge() {
  if (!state.charging) {
    state.pointer.down = false;
    return;
  }

  const strength = Math.max(0.18, state.charge);
  state.pointer.down = false;
  state.charging = false;
  state.charge = 0;
  pulse(strength);
}

function moveTargetTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = width / rect.width;
  const ratioY = height / rect.height;

  state.target.x = clamp(
    (clientX - rect.left) * ratioX,
    stagePadding,
    width - stagePadding,
  );
  state.target.y = clamp(
    (clientY - rect.top) * ratioY,
    stagePadding,
    height - stagePadding,
  );
  state.pointer.moved = true;
}

function collideWithBounds() {
  const minX = stagePadding;
  const maxX = width - stagePadding;
  const minY = stagePadding;
  const maxY = height - stagePadding;

  if (state.core.x < minX) {
    state.core.x = minX;
    if (state.core.vx < 0) {
      state.core.vx = -state.core.vx * 0.54;
      state.camera.trauma = clamp(state.camera.trauma + 0.08, 0, 1);
      spawnRing(state.core.x, state.core.y, 0.2);
      spawnSparks(state.core.x, state.core.y, 1, 0, 7, 0.2);
    }
  }

  if (state.core.x > maxX) {
    state.core.x = maxX;
    if (state.core.vx > 0) {
      state.core.vx = -state.core.vx * 0.54;
      state.camera.trauma = clamp(state.camera.trauma + 0.08, 0, 1);
      spawnRing(state.core.x, state.core.y, 0.2);
      spawnSparks(state.core.x, state.core.y, -1, 0, 7, 0.2);
    }
  }

  if (state.core.y < minY) {
    state.core.y = minY;
    if (state.core.vy < 0) {
      state.core.vy = -state.core.vy * 0.54;
      state.camera.trauma = clamp(state.camera.trauma + 0.08, 0, 1);
      spawnRing(state.core.x, state.core.y, 0.2);
      spawnSparks(state.core.x, state.core.y, 0, 1, 7, 0.2);
    }
  }

  if (state.core.y > maxY) {
    state.core.y = maxY;
    if (state.core.vy > 0) {
      state.core.vy = -state.core.vy * 0.54;
      state.camera.trauma = clamp(state.camera.trauma + 0.08, 0, 1);
      spawnRing(state.core.x, state.core.y, 0.2);
      spawnSparks(state.core.x, state.core.y, 0, -1, 7, 0.2);
    }
  }
}

function pushRibbon(speed) {
  state.ribbons.push({
    x: state.core.x,
    y: state.core.y,
    rotation: state.core.rotation,
    width: 18 + speed * 0.018 + state.charge * 22,
    length: 24 + speed * 0.034 + state.charge * 34,
    life: 0.28 + state.charge * 0.2,
    alpha: 0.06 + Math.min(0.18, speed * 0.00022 + state.charge * 0.18),
  });
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
  } else if (state.charging && state.charge > 0.78) {
    state.message = "かなりためている";
  } else if (state.charging) {
    state.message = "ためている";
  } else if (speed > 620) {
    state.message = "鋭く流れている";
  } else if (speed > 240) {
    state.message = "滑っている";
  } else if (speed > 60) {
    state.message = "戻っている";
  } else {
    state.message = "静か";
  }
}

function update(dt) {
  state.time += dt;

  if (state.active) {
    const keyboardX = Number(state.keys.right) - Number(state.keys.left);
    const keyboardY = Number(state.keys.down) - Number(state.keys.up);
    const keyboardLength = length(keyboardX, keyboardY);

    if (keyboardLength > 0) {
      const normalizedX = keyboardX / keyboardLength;
      const normalizedY = keyboardY / keyboardLength;
      state.target.x = clamp(
        state.target.x + normalizedX * 440 * dt,
        stagePadding,
        width - stagePadding,
      );
      state.target.y = clamp(
        state.target.y + normalizedY * 440 * dt,
        stagePadding,
        height - stagePadding,
      );
    }

    const aimDirection = normalize(
      state.target.x - state.core.x,
      state.target.y - state.core.y,
      state.aim.x,
      state.aim.y,
    );
    state.aim.x = aimDirection.x;
    state.aim.y = aimDirection.y;

    if (state.charging || state.keys.charge) {
      state.charge = clamp(state.charge + dt * 1.8, 0, 1);
      state.charging = true;
    } else {
      state.charge = clamp(state.charge - dt * 2.6, 0, 1);
    }

    const spring = 16.5;
    const damping = 7.9;

    let accelerationX =
      (state.target.x - state.core.x) * spring - state.core.vx * damping;
    let accelerationY =
      (state.target.y - state.core.y) * spring - state.core.vy * damping;

    if (state.charging) {
      const drag = 180 + state.charge * 520;
      accelerationX -= aimDirection.x * drag;
      accelerationY -= aimDirection.y * drag;
    }

    state.core.vx += accelerationX * dt;
    state.core.vy += accelerationY * dt;

    const speed = length(state.core.vx, state.core.vy);
    const maxSpeed = 1180;
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      state.core.vx *= ratio;
      state.core.vy *= ratio;
    }

    state.core.x += state.core.vx * dt;
    state.core.y += state.core.vy * dt;
    collideWithBounds();

    const updatedSpeed = length(state.core.vx, state.core.vy);
    const rotationTarget = clamp(
      state.core.vx * 0.00112 + (state.target.x - state.core.x) * 0.00035,
      -0.62,
      0.62,
    );
    state.core.rotation = damp(state.core.rotation, rotationTarget, 14, dt);

    const stretch =
      Math.min(0.24, updatedSpeed * 0.00022) + state.charge * 0.13;
    const squeeze =
      Math.min(0.12, updatedSpeed * 0.00012) + state.charge * 0.08;
    state.core.scaleX = damp(state.core.scaleX, 1 + stretch, 15, dt);
    state.core.scaleY = damp(state.core.scaleY, 1 - squeeze, 15, dt);

    state.camera.trauma = Math.max(0, state.camera.trauma - dt * 1.8);
    state.camera.x = damp(
      state.camera.x,
      (state.target.x - width * 0.5) * 0.018 + state.core.vx * 0.01,
      6,
      dt,
    );
    state.camera.y = damp(
      state.camera.y,
      (state.target.y - height * 0.5) * 0.018 + state.core.vy * 0.01,
      6,
      dt,
    );

    state.ribbonClock += dt;
    if (
      (updatedSpeed > 16 || state.charge > 0.02) &&
      state.ribbonClock >= 0.014
    ) {
      state.ribbonClock = 0;
      pushRibbon(updatedSpeed);
    }

    updateMessage(dt, updatedSpeed);
  } else {
    state.camera.trauma = 0;
    state.core.rotation = damp(state.core.rotation, 0, 8, dt);
    state.core.scaleX = damp(state.core.scaleX, 1, 8, dt);
    state.core.scaleY = damp(state.core.scaleY, 1, 8, dt);
  }

  state.ribbons = state.ribbons.filter((ribbon) => {
    ribbon.life -= dt;
    ribbon.alpha *= 0.965;
    ribbon.length *= 0.992;
    ribbon.width *= 0.99;
    return ribbon.life > 0.01 && ribbon.alpha > 0.01;
  });

  state.sparks = state.sparks.filter((spark) => {
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= 0.94;
    spark.vy *= 0.94;
    return spark.life > 0;
  });

  state.rings = state.rings.filter((ring) => {
    ring.life -= dt;
    ring.radius += dt * 220;
    ring.alpha *= 0.958;
    return ring.life > 0 && ring.alpha > 0.01;
  });

  updateUi();
}

function drawField(time) {
  context.fillStyle = "#050403";
  context.fillRect(0, 0, width, height);

  context.save();
  context.strokeStyle = "rgba(255, 238, 222, 0.06)";
  context.lineWidth = 1;

  for (let index = 0; index < 14; index += 1) {
    const y = 42 + index * 40 + Math.sin(time * 0.8 + index * 0.38) * 4;
    context.beginPath();
    context.moveTo(30, y);
    context.bezierCurveTo(
      width * 0.28,
      y + Math.sin(time + index) * 5,
      width * 0.72,
      y - Math.cos(time * 0.8 + index) * 5,
      width - 30,
      y,
    );
    context.stroke();
  }

  for (let index = 0; index < 8; index += 1) {
    const x = 80 + index * 114 + Math.sin(time * 0.45 + index) * 8;
    context.beginPath();
    context.moveTo(x, 24);
    context.lineTo(x, height - 24);
    context.stroke();
  }

  context.restore();

  const glow = context.createLinearGradient(0, 0, 0, height);
  glow.addColorStop(0, "rgba(255, 106, 19, 0.08)");
  glow.addColorStop(0.3, "rgba(255, 106, 19, 0)");
  glow.addColorStop(0.7, "rgba(255, 106, 19, 0)");
  glow.addColorStop(1, "rgba(255, 106, 19, 0.07)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255, 238, 222, 0.12)";
  context.strokeRect(22.5, 22.5, width - 45, height - 45);
}

function drawTarget() {
  const radius = 18 + state.charge * 26;

  context.save();
  context.translate(state.target.x, state.target.y);

  context.strokeStyle = `rgba(255, 106, 19, ${0.18 + state.charge * 0.44})`;
  context.lineWidth = 1.5 + state.charge * 1.4;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "rgba(255, 238, 222, 0.26)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-8, 0);
  context.lineTo(8, 0);
  context.moveTo(0, -8);
  context.lineTo(0, 8);
  context.stroke();

  context.restore();
}

function drawTension() {
  const distance = length(
    state.target.x - state.core.x,
    state.target.y - state.core.y,
  );

  if (distance < 14 && state.charge < 0.03) {
    return;
  }

  context.save();
  context.strokeStyle = `rgba(255, 106, 19, ${0.08 + state.charge * 0.32})`;
  context.lineWidth = 1.2 + state.charge * 1.8;
  context.beginPath();
  context.moveTo(state.core.x, state.core.y);
  context.quadraticCurveTo(
    (state.core.x + state.target.x) * 0.5 + state.aim.y * 12,
    (state.core.y + state.target.y) * 0.5 - state.aim.x * 12,
    state.target.x,
    state.target.y,
  );
  context.stroke();
  context.restore();
}

function drawRibbons() {
  state.ribbons.forEach((ribbon) => {
    context.save();
    context.translate(ribbon.x, ribbon.y);
    context.rotate(ribbon.rotation);
    context.fillStyle = `rgba(255, 106, 19, ${ribbon.alpha})`;
    context.fillRect(
      -ribbon.length * 0.78,
      -ribbon.width * 0.5,
      ribbon.length,
      ribbon.width,
    );

    context.fillStyle = `rgba(255, 239, 226, ${ribbon.alpha * 0.35})`;
    context.fillRect(
      -ribbon.length * 0.58,
      -ribbon.width * 0.16,
      ribbon.length * 0.56,
      ribbon.width * 0.32,
    );
    context.restore();
  });
}

function drawRings() {
  state.rings.forEach((ring) => {
    context.save();
    context.strokeStyle = `rgba(255, 106, 19, ${ring.alpha})`;
    context.lineWidth = ring.width;
    context.beginPath();
    context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawSparks() {
  state.sparks.forEach((spark) => {
    const speed = length(spark.vx, spark.vy);
    const direction = normalize(spark.vx, spark.vy, 1, 0);

    context.save();
    context.strokeStyle = `rgba(255, 228, 206, ${spark.alpha * clamp(spark.life * 1.8, 0, 1)})`;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(spark.x, spark.y);
    context.lineTo(
      spark.x - direction.x * (spark.length + speed * 0.012),
      spark.y - direction.y * (spark.length + speed * 0.012),
    );
    context.stroke();
    context.restore();
  });
}

function drawCore() {
  const speed = length(state.core.vx, state.core.vy);
  const glowAlpha = 0.18 + Math.min(0.18, speed * 0.0002) + state.charge * 0.18;

  context.save();
  context.translate(state.core.x, state.core.y);
  context.rotate(state.core.rotation);
  context.scale(state.core.scaleX, state.core.scaleY);

  context.fillStyle = `rgba(255, 106, 19, ${glowAlpha})`;
  context.fillRect(-82, -18, 164, 36);

  context.fillStyle = "#ff6a13";
  context.beginPath();
  context.moveTo(-56, -17);
  context.lineTo(28, -17);
  context.lineTo(50, 0);
  context.lineTo(28, 17);
  context.lineTo(-56, 17);
  context.lineTo(-40, 0);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffd7bb";
  context.beginPath();
  context.moveTo(-34, -5);
  context.lineTo(16, -5);
  context.lineTo(24, 0);
  context.lineTo(16, 5);
  context.lineTo(-34, 5);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(255, 240, 229, 0.38)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(-56, -17);
  context.lineTo(28, -17);
  context.lineTo(50, 0);
  context.lineTo(28, 17);
  context.lineTo(-56, 17);
  context.lineTo(-40, 0);
  context.closePath();
  context.stroke();
  context.restore();
}

function draw(timestamp) {
  const time = timestamp / 1000;
  const shake = state.camera.trauma * state.camera.trauma * 8;
  const jitterX = (Math.random() - 0.5) * shake;
  const jitterY = (Math.random() - 0.5) * shake;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(-state.camera.x + jitterX, -state.camera.y + jitterY);
  drawField(time);
  drawTarget();
  drawTension();
  drawRibbons();
  drawRings();
  drawSparks();
  drawCore();
  context.restore();
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
    activateInteraction();
    return;
  }

  resetMotion();
}

canvas.addEventListener("mousemove", (event) => {
  if (!state.active) {
    return;
  }

  moveTargetTo(event.clientX, event.clientY);
});

canvas.addEventListener("mousedown", (event) => {
  ensureActive();
  moveTargetTo(event.clientX, event.clientY);
  beginCharge();
});

window.addEventListener("mouseup", () => {
  endCharge();
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    if (!event.touches[0]) {
      return;
    }

    ensureActive();
    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
    beginCharge();
  },
  { passive: true },
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!state.active || !event.touches[0]) {
      return;
    }

    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
  },
  { passive: true },
);

window.addEventListener("touchend", () => {
  endCharge();
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
    state.keys.charge = true;
    beginCharge();
    event.preventDefault();
  }

  if (key === "enter" && !state.active) {
    activateInteraction();
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
    state.keys.charge = false;
    endCharge();
    event.preventDefault();
  }
});

startButton.addEventListener("click", startOrReset);
overlayButton.addEventListener("click", startOrReset);

updateUi();
setOverlay(
  "シグナルループ",
  "押して、ためて、離す。反応だけ見てください。",
  "触る",
);

requestAnimationFrame((timestamp) => {
  state.lastTick = timestamp;
  draw(timestamp);
  requestAnimationFrame(tick);
});
