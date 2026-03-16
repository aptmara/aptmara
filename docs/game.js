const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const timeValue = document.getElementById("time-value");
const livesValue = document.getElementById("lives-value");
const startButton = document.getElementById("start-button");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const overlayButton = document.getElementById("overlay-button");

const width = canvas.width;
const height = canvas.height;
const bestKey = "aptmara-signal-loop-best";

const state = {
  running: false,
  score: 0,
  best: Number.parseInt(localStorage.getItem(bestKey) ?? "0", 10) || 0,
  lives: 3,
  timeLeft: 60,
  elapsed: 0,
  spawnClock: 0,
  gameClock: 0,
  pointerX: width / 2,
  playerX: width / 2,
  keys: new Set(),
  particles: [],
  drops: [],
  lastTick: performance.now(),
};

const player = {
  width: 88,
  height: 18,
  y: height - 48,
  speed: 360,
};

function setOverlay(title, copy, buttonLabel) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlayButton.textContent = buttonLabel;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function updateHud() {
  scoreValue.textContent = String(state.score);
  bestValue.textContent = String(state.best);
  timeValue.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  livesValue.textContent = String(state.lives);
}

function resetGame() {
  state.running = true;
  state.score = 0;
  state.lives = 3;
  state.timeLeft = 60;
  state.elapsed = 0;
  state.spawnClock = 0;
  state.gameClock = 0;
  state.pointerX = width / 2;
  state.playerX = width / 2;
  state.drops = [];
  state.particles = [];
  state.lastTick = performance.now();
  hideOverlay();
  updateHud();
}

function finishGame() {
  state.running = false;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(bestKey, String(state.best));
  }

  updateHud();
  setOverlay(
    "終了",
    `今回 ${state.score} 点 / 最高 ${state.best} 点。もう一回遊ぶなら再挑戦。`,
    "再挑戦",
  );
}

function spawnDrop() {
  const isNoise = Math.random() < 0.28;
  const size = isNoise ? 15 + Math.random() * 10 : 12 + Math.random() * 9;

  state.drops.push({
    x: 40 + Math.random() * (width - 80),
    y: -30,
    radius: size,
    speed: (isNoise ? 180 : 150) + Math.random() * 90 + state.elapsed * 1.2,
    drift: (Math.random() - 0.5) * 24,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 1 + Math.random() * 2,
    kind: isNoise ? "noise" : "signal",
  });
}

function emitParticles(x, y, color, amount) {
  for (let index = 0; index < amount; index += 1) {
    const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.4;
    const speed = 70 + Math.random() * 120;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.35,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function handleCollect(drop) {
  if (drop.kind === "signal") {
    state.score += 1;
    emitParticles(drop.x, drop.y, "#f97316", 12);
  } else {
    state.lives -= 1;
    emitParticles(drop.x, drop.y, "#fb7185", 18);
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(bestKey, String(state.best));
  }

  updateHud();

  if (state.lives <= 0) {
    finishGame();
  }
}

function update(dt) {
  if (!state.running) {
    return;
  }

  state.elapsed += dt;
  state.gameClock += dt;
  state.spawnClock += dt;
  state.timeLeft = Math.max(0, 60 - state.gameClock);

  const keyboardDirection = Number(state.keys.has("arrowright") || state.keys.has("d")) -
    Number(state.keys.has("arrowleft") || state.keys.has("a"));

  if (keyboardDirection !== 0) {
    state.pointerX += keyboardDirection * player.speed * dt;
  }

  state.pointerX = Math.max(player.width / 2, Math.min(width - player.width / 2, state.pointerX));
  state.playerX += (state.pointerX - state.playerX) * Math.min(1, dt * 14);

  const spawnInterval = Math.max(0.28, 0.72 - state.elapsed * 0.0038);
  if (state.spawnClock >= spawnInterval) {
    state.spawnClock = 0;
    spawnDrop();
  }

  state.drops = state.drops.filter((drop) => {
    drop.y += drop.speed * dt;
    drop.x += Math.sin(state.elapsed * drop.wobbleSpeed + drop.wobble) * drop.drift * dt;

    const playerLeft = state.playerX - player.width / 2;
    const playerRight = state.playerX + player.width / 2;
    const playerTop = player.y;
    const playerBottom = player.y + player.height;

    const closestX = Math.max(playerLeft, Math.min(drop.x, playerRight));
    const closestY = Math.max(playerTop, Math.min(drop.y, playerBottom));
    const dx = drop.x - closestX;
    const dy = drop.y - closestY;

    if ((dx * dx) + (dy * dy) < drop.radius * drop.radius) {
      handleCollect(drop);
      return false;
    }

    if (drop.y - drop.radius > height + 8) {
      if (drop.kind === "signal") {
        state.lives -= 1;
        emitParticles(drop.x, height - 18, "#facc15", 10);
        updateHud();
        if (state.lives <= 0) {
          finishGame();
        }
      }
      return false;
    }

    return true;
  });

  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });

  if (state.timeLeft <= 0) {
    finishGame();
  }

  updateHud();
}

function drawBackground(time) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#060b14";
  context.fillRect(0, 0, width, height);

  context.save();
  context.strokeStyle = "rgba(148, 163, 184, 0.08)";
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += 32) {
    context.beginPath();
    context.moveTo(x + (time * 12 % 32), 0);
    context.lineTo(x + (time * 12 % 32), height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();

  const glow = context.createRadialGradient(width / 2, -40, 10, width / 2, -40, 460);
  glow.addColorStop(0, "rgba(249, 115, 22, 0.20)");
  glow.addColorStop(1, "rgba(249, 115, 22, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function drawPlayer() {
  const left = state.playerX - player.width / 2;
  const top = player.y;

  context.save();
  context.fillStyle = "#f97316";
  context.shadowColor = "rgba(249, 115, 22, 0.35)";
  context.shadowBlur = 22;
  context.beginPath();
  context.roundRect(left, top, player.width, player.height, 9);
  context.fill();

  context.fillStyle = "#fed7aa";
  context.beginPath();
  context.roundRect(left + 10, top + 5, player.width - 20, 4, 2);
  context.fill();
  context.restore();
}

function drawDrops(time) {
  state.drops.forEach((drop) => {
    context.save();
    context.translate(drop.x, drop.y);

    if (drop.kind === "signal") {
      context.fillStyle = "#f97316";
      context.shadowColor = "rgba(249, 115, 22, 0.4)";
      context.shadowBlur = 18;
      context.beginPath();
      context.arc(0, 0, drop.radius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#ffedd5";
      context.beginPath();
      context.arc(
        Math.cos(time * 3 + drop.x * 0.01) * 3,
        Math.sin(time * 4 + drop.y * 0.01) * 3,
        drop.radius * 0.36,
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      context.strokeStyle = "#94a3b8";
      context.lineWidth = 2.6;
      context.beginPath();
      context.arc(0, 0, drop.radius, 0, Math.PI * 2);
      context.stroke();

      context.beginPath();
      context.moveTo(-drop.radius * 0.5, -drop.radius * 0.5);
      context.lineTo(drop.radius * 0.5, drop.radius * 0.5);
      context.moveTo(drop.radius * 0.5, -drop.radius * 0.5);
      context.lineTo(-drop.radius * 0.5, drop.radius * 0.5);
      context.stroke();
    }

    context.restore();
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    context.save();
    context.globalAlpha = Math.max(0, particle.life);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawUi() {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  context.fillRect(24, 24, 212, 54);
  context.fillStyle = "#cbd5e1";
  context.font = "14px 'Zen Kaku Gothic New'";
  context.fillText("シグナルを拾う / ノイズを避ける", 40, 57);
  context.restore();
}

function draw(timestamp) {
  const time = timestamp / 1000;
  drawBackground(time);
  drawUi();
  drawPlayer();
  drawDrops(time);
  drawParticles();
}

function tick(timestamp) {
  const dt = Math.min(0.032, (timestamp - state.lastTick) / 1000);
  state.lastTick = timestamp;
  update(dt);
  draw(timestamp);
  requestAnimationFrame(tick);
}

function setPointerPosition(clientX) {
  const rect = canvas.getBoundingClientRect();
  const ratio = width / rect.width;
  state.pointerX = (clientX - rect.left) * ratio;
}

function startGame() {
  resetGame();
}

canvas.addEventListener("mousemove", (event) => {
  setPointerPosition(event.clientX);
});

canvas.addEventListener("touchstart", (event) => {
  if (event.touches[0]) {
    setPointerPosition(event.touches[0].clientX);
  }
}, { passive: true });

canvas.addEventListener("touchmove", (event) => {
  if (event.touches[0]) {
    setPointerPosition(event.touches[0].clientX);
  }
}, { passive: true });

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
    state.keys.add(key);
    event.preventDefault();
  }

  if ((key === " " || key === "enter") && !state.running) {
    startGame();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key.toLowerCase());
});

startButton.addEventListener("click", startGame);
overlayButton.addEventListener("click", startGame);

updateHud();
setOverlay("SIGNAL LOOP", "開始するを押してスタート。シグナルは拾って、ノイズは避ける。", "遊ぶ");
requestAnimationFrame((timestamp) => {
  state.lastTick = timestamp;
  draw(timestamp);
  requestAnimationFrame(tick);
});
