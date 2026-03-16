const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const startButton = document.getElementById("start-button");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const overlayButton = document.getElementById("overlay-button");
const progressBar = document.getElementById("progress-bar");
const stateText = document.getElementById("state-text");

const width = canvas.width;
const height = canvas.height;
const topBound = 88;
const sidePadding = 84;
const trayTop = 46;
const trayHeight = 136;
const looseTop = 224;
const looseBottom = height - 86;
const centerX = width * 0.5;
const centerY = height * 0.74;
const tau = Math.PI * 2;

const slots = [
  { id: 0, kind: "circle", color: "#ef7b63", x: 150, y: 114 },
  { id: 1, kind: "square", color: "#f5ca77", x: 328, y: 114 },
  { id: 2, kind: "capsule", color: "#8ecfda", x: 506, y: 114 },
  { id: 3, kind: "diamond", color: "#9dc58a", x: 684, y: 114 },
  { id: 4, kind: "flower", color: "#dca186", x: 812, y: 114 },
];

const scatterBases = [
  { x: 216, y: 334, rotation: -0.36 },
  { x: 734, y: 316, rotation: 0.38 },
  { x: 592, y: 456, rotation: -0.18 },
  { x: 308, y: 498, rotation: 0.34 },
  { x: 474, y: 384, rotation: -0.24 },
];

function createPieces() {
  return slots.map((slot, index) => {
    const base = scatterBases[index];

    return {
      id: slot.id,
      kind: slot.kind,
      color: slot.color,
      homeX: slot.x,
      homeY: slot.y,
      x: base.x + (Math.random() - 0.5) * 28,
      y: base.y + (Math.random() - 0.5) * 22,
      vx: 0,
      vy: 0,
      rotation: base.rotation + (Math.random() - 0.5) * 0.12,
      rotationVelocity: 0,
      scale: 1,
      sorted: false,
      snap: 0,
    };
  });
}

const state = {
  active: false,
  time: 0,
  lastTick: performance.now(),
  message: `あと${slots.length}つ`,
  messageTimer: 0,
  completed: 0,
  grabbedId: null,
  hoveredId: null,
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
  pieces: createPieces(),
  puffs: [],
  chips: [],
  ripples: [],
  slotGlow: slots.map(() => 0),
  slotJolt: slots.map(() => 0),
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

function roundedRectPath(targetContext, x, y, boxWidth, boxHeight, radius) {
  const safeRadius = Math.min(radius, boxWidth * 0.5, boxHeight * 0.5);

  targetContext.beginPath();
  targetContext.moveTo(x + safeRadius, y);
  targetContext.lineTo(x + boxWidth - safeRadius, y);
  targetContext.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + safeRadius);
  targetContext.lineTo(x + boxWidth, y + boxHeight - safeRadius);
  targetContext.quadraticCurveTo(
    x + boxWidth,
    y + boxHeight,
    x + boxWidth - safeRadius,
    y + boxHeight,
  );
  targetContext.lineTo(x + safeRadius, y + boxHeight);
  targetContext.quadraticCurveTo(
    x,
    y + boxHeight,
    x,
    y + boxHeight - safeRadius,
  );
  targetContext.lineTo(x, y + safeRadius);
  targetContext.quadraticCurveTo(x, y, x + safeRadius, y);
  targetContext.closePath();
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function tracePieceShape(kind, scale = 1) {
  switch (kind) {
    case "circle":
      context.beginPath();
      context.arc(0, 0, 31 * scale, 0, tau);
      break;
    case "square":
      roundedRectPath(
        context,
        -34 * scale,
        -34 * scale,
        68 * scale,
        68 * scale,
        18 * scale,
      );
      break;
    case "capsule":
      roundedRectPath(
        context,
        -48 * scale,
        -24 * scale,
        96 * scale,
        48 * scale,
        24 * scale,
      );
      break;
    case "diamond":
      context.beginPath();
      context.moveTo(0, -42 * scale);
      context.lineTo(42 * scale, 0);
      context.lineTo(0, 42 * scale);
      context.lineTo(-42 * scale, 0);
      context.closePath();
      break;
    case "flower":
      context.beginPath();
      context.arc(-18 * scale, -10 * scale, 18 * scale, 0, tau);
      context.arc(18 * scale, -10 * scale, 18 * scale, 0, tau);
      context.arc(16 * scale, 18 * scale, 18 * scale, 0, tau);
      context.arc(-16 * scale, 18 * scale, 18 * scale, 0, tau);
      context.closePath();
      break;
    default:
      context.beginPath();
      context.arc(0, 0, 30 * scale, 0, tau);
      break;
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

function setMessage(message, duration = 0.24) {
  state.message = message;
  state.messageTimer = duration;
}

function getRemainingCount() {
  return state.pieces.length - state.completed;
}

function updateUi() {
  const ratio =
    state.pieces.length === 0 ? 0 : state.completed / state.pieces.length;

  progressBar.style.width = `${Math.round(ratio * 100)}%`;
  stateText.textContent = state.message;
  stateText.classList.toggle(
    "is-complete",
    state.active && state.completed === state.pieces.length,
  );

  if (!state.active) {
    startButton.textContent = "はじめる";
  } else if (state.completed === state.pieces.length) {
    startButton.textContent = "もう一回";
  } else {
    startButton.textContent = "並べ直す";
  }
}

function resetBlobPosition() {
  state.pointer.x = centerX;
  state.pointer.y = centerY;
  state.target.x = centerX;
  state.target.y = centerY;
  state.pointer.down = false;
  state.hoveredId = null;
  state.keys.hold = false;
  state.blob.x = centerX;
  state.blob.y = centerY;
  state.blob.vx = 0;
  state.blob.vy = 0;
  state.blob.tilt = 0;
  state.blob.scaleX = 1;
  state.blob.scaleY = 1;
}

function resetRound() {
  state.active = true;
  state.completed = 0;
  state.grabbedId = null;
  state.hoveredId = null;
  state.time = 0;
  state.messageTimer = 0;
  state.pieces = createPieces();
  state.puffs = [];
  state.chips = [];
  state.ripples = [];
  state.slotGlow = slots.map(() => 0);
  state.slotJolt = slots.map(() => 0);
  resetBlobPosition();
  hideOverlay();
  setMessage(`あと${slots.length}つ`, 0.5);
  updateUi();
}

function activate() {
  if (state.active) {
    return;
  }

  state.active = true;
  hideOverlay();
  setMessage(`あと${getRemainingCount()}つ`, 0.5);
  updateUi();
}

function ensureActive() {
  if (!state.active) {
    activate();
  }
}

function emitPuffs(x, y, color, count = 4, spread = 1) {
  for (let index = 0; index < count; index += 1) {
    const angle = (tau * index) / count + Math.random() * 0.35;
    const speed = 30 + Math.random() * 44 + spread * 36;

    state.puffs.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.72,
      radius: 10 + Math.random() * 10 + spread * 4,
      life: 0.24 + Math.random() * 0.14,
      alpha: 0.26 + Math.random() * 0.12,
      color,
    });
  }
}

function emitChips(x, y, color, count = 7) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * tau;
    const speed = 70 + Math.random() * 90;

    state.chips.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.74 - 20,
      width: 8 + Math.random() * 10,
      height: 5 + Math.random() * 7,
      rotation: Math.random() * tau,
      spin: (Math.random() - 0.5) * 8,
      life: 0.34 + Math.random() * 0.22,
      alpha: 0.34 + Math.random() * 0.16,
      color,
    });
  }
}

function emitRipples(x, y, color, count = 2) {
  for (let index = 0; index < count; index += 1) {
    state.ripples.push({
      x,
      y,
      radius: 24 + index * 18,
      width: 3.5 - index * 0.8,
      life: 0.34 + index * 0.08,
      alpha: 0.28 - index * 0.06,
      color,
    });
  }
}

function findNearestSlot(x, y) {
  let nearest = null;

  slots.forEach((slot) => {
    const distance = length(slot.x - x, slot.y - y);

    if (!nearest || distance < nearest.distance) {
      nearest = {
        slot,
        distance,
      };
    }
  });

  return nearest;
}

function findNearestLoosePiece(anchorX, anchorY, maxDistance = 92) {
  let nearestPiece = null;
  let nearestDistance = maxDistance;

  state.pieces.forEach((piece) => {
    if (piece.sorted) {
      return;
    }

    const distance = length(piece.x - anchorX, piece.y - anchorY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPiece = piece;
    }
  });

  return nearestPiece;
}

function updateHoveredPiece() {
  if (!state.active || state.grabbedId !== null) {
    state.hoveredId = null;
    return;
  }

  const hovered = findNearestLoosePiece(state.target.x, state.target.y, 124);
  state.hoveredId = hovered ? hovered.id : null;
}

function grabPiece(piece) {
  state.grabbedId = piece.id;
  piece.vx *= 0.24;
  piece.vy *= 0.24;
  piece.rotationVelocity *= 0.3;
  piece.scale = Math.max(piece.scale, 1.04);
  emitPuffs(piece.x, piece.y, hexToRgba(piece.color, 0.34), 3, 0.8);
  pulseDevice(8);
  setMessage("つまんだ", 0.18);
}

function trySnapPiece(piece, threshold = 94) {
  const slot = slots[piece.id];
  const distance = length(piece.x - slot.x, piece.y - slot.y);

  if (distance > threshold) {
    return false;
  }

  piece.sorted = true;
  piece.x = slot.x;
  piece.y = slot.y;
  piece.vx = 0;
  piece.vy = 0;
  piece.rotation = 0;
  piece.rotationVelocity = 0;
  piece.scale = 1.08;
  piece.snap = 1;

  state.completed += 1;
  state.slotGlow[piece.id] = 1;
  state.slotJolt[piece.id] = 0;

  emitPuffs(slot.x, slot.y, hexToRgba(piece.color, 0.36), 7, 1.25);
  emitChips(slot.x, slot.y, piece.color, 8);
  emitRipples(slot.x, slot.y, piece.color, 2);
  pulseDevice(12);

  if (state.completed === state.pieces.length) {
    setMessage("きれいにそろった", 0.9);
    setOverlay(
      "きれいにそろった",
      "もう一回ならべ直せます。置いたときの収まり方だけを見ても大丈夫です。",
      "もう一回",
    );
  } else {
    setMessage(`あと${getRemainingCount()}つ`, 0.5);
  }

  updateUi();
  return true;
}

function tryGrabNearestPiece() {
  if (state.grabbedId !== null) {
    return;
  }

  const nearest =
    findNearestLoosePiece(state.target.x, state.target.y, 124) ??
    findNearestLoosePiece(state.blob.x, state.blob.y, 102);

  if (nearest) {
    grabPiece(nearest);
    return;
  }

  setMessage("近くの小物に寄せる", 0.24);
}

function beginHold() {
  ensureActive();
  state.pointer.down = true;
  tryGrabNearestPiece();
}

function releasePiece() {
  if (state.grabbedId === null) {
    state.pointer.down = false;
    return;
  }

  const piece = state.pieces[state.grabbedId];
  state.grabbedId = null;

  piece.vx += state.blob.vx * 0.45;
  piece.vy += state.blob.vy * 0.45;
  piece.rotationVelocity += clamp(state.blob.vx * 0.0009, -0.08, 0.08);

  if (trySnapPiece(piece)) {
    state.pointer.down = false;
    return;
  }

  const nearestSlot = findNearestSlot(piece.x, piece.y);
  if (
    nearestSlot &&
    nearestSlot.distance < 92 &&
    nearestSlot.slot.id !== piece.id
  ) {
    const push = normalize(
      piece.x - nearestSlot.slot.x,
      piece.y - nearestSlot.slot.y,
      0,
      1,
    );

    piece.vx += push.x * 160;
    piece.vy += Math.max(40, push.y * 150);
    state.slotJolt[nearestSlot.slot.id] = 1;
    emitPuffs(piece.x, piece.y, "rgba(255, 248, 239, 0.42)", 3, 0.7);
    emitRipples(
      nearestSlot.slot.x,
      nearestSlot.slot.y,
      nearestSlot.slot.color,
      1,
    );
    setMessage("そこは別の場所", 0.3);
  } else {
    setMessage(`あと${getRemainingCount()}つ`, 0.2);
  }

  pulseDevice(4);
  state.pointer.down = false;
}

function moveTargetTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = width / rect.width;
  const ratioY = height / rect.height;

  state.pointer.x = (clientX - rect.left) * ratioX;
  state.pointer.y = (clientY - rect.top) * ratioY;
  state.target.x = clamp(state.pointer.x, sidePadding, width - sidePadding);
  state.target.y = clamp(state.pointer.y, topBound, height - 88);
}

function bounceBlobBounds() {
  const minX = sidePadding;
  const maxX = width - sidePadding;
  const minY = topBound;
  const maxY = height - 88;

  if (state.blob.x < minX) {
    state.blob.x = minX;
    if (state.blob.vx < 0) {
      state.blob.vx *= -0.3;
    }
  }

  if (state.blob.x > maxX) {
    state.blob.x = maxX;
    if (state.blob.vx > 0) {
      state.blob.vx *= -0.3;
    }
  }

  if (state.blob.y < minY) {
    state.blob.y = minY;
    if (state.blob.vy < 0) {
      state.blob.vy *= -0.3;
    }
  }

  if (state.blob.y > maxY) {
    state.blob.y = maxY;
    if (state.blob.vy > 0) {
      state.blob.vy *= -0.3;
    }
  }
}

function bounceLoosePiece(piece) {
  if (piece.x < sidePadding) {
    piece.x = sidePadding;
    if (piece.vx < 0) {
      piece.vx *= -0.34;
    }
  }

  if (piece.x > width - sidePadding) {
    piece.x = width - sidePadding;
    if (piece.vx > 0) {
      piece.vx *= -0.34;
    }
  }

  if (piece.y < looseTop) {
    piece.y = looseTop;
    if (piece.vy < 0) {
      piece.vy = Math.abs(piece.vy) * 0.18;
    }
  }

  if (piece.y > looseBottom) {
    piece.y = looseBottom;
    if (piece.vy > 0) {
      piece.vy *= -0.26;
    }
  }
}

function updateMessage(dt) {
  if (state.messageTimer > 0) {
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (state.messageTimer > 0) {
      return;
    }
  }

  if (!state.active) {
    state.message = `あと${getRemainingCount()}つ`;
    return;
  }

  if (state.completed === state.pieces.length) {
    state.message = "きれいにそろった";
    return;
  }

  if (state.grabbedId !== null) {
    const piece = state.pieces[state.grabbedId];
    const slot = slots[piece.id];
    const distance = length(piece.x - slot.x, piece.y - slot.y);
    state.message = distance < 128 ? "そこなら収まる" : "置き場所へ運ぶ";
    return;
  }

  state.message = `あと${getRemainingCount()}つ`;
}

function updateSlotFeedback(dt) {
  state.slotGlow = state.slotGlow.map((value) => Math.max(0, value - dt * 2.4));
  state.slotJolt = state.slotJolt.map((value) => Math.max(0, value - dt * 5.2));
}

function updateBlob(dt) {
  const inputX = Number(state.keys.right) - Number(state.keys.left);
  const inputY = Number(state.keys.down) - Number(state.keys.up);
  const inputLength = length(inputX, inputY);

  if (inputLength > 0) {
    state.target.x = clamp(
      state.target.x + (inputX / inputLength) * 340 * dt,
      sidePadding,
      width - sidePadding,
    );
    state.target.y = clamp(
      state.target.y + (inputY / inputLength) * 340 * dt,
      topBound,
      height - 88,
    );
  }

  const spring = state.grabbedId !== null ? 20 : 14;
  const damping = state.grabbedId !== null ? 10.5 : 11.8;

  state.blob.vx +=
    ((state.target.x - state.blob.x) * spring - state.blob.vx * damping) * dt;
  state.blob.vy +=
    ((state.target.y - state.blob.y) * spring - state.blob.vy * damping) * dt;
  state.blob.x += state.blob.vx * dt;
  state.blob.y += state.blob.vy * dt;
  bounceBlobBounds();

  const speed = length(state.blob.vx, state.blob.vy);
  const squeeze =
    state.pointer.down || state.keys.hold || state.grabbedId !== null ? 1 : 0;

  state.blob.scaleX = damp(
    state.blob.scaleX,
    1 + Math.min(0.16, speed * 0.00018) + squeeze * 0.05,
    12,
    dt,
  );
  state.blob.scaleY = damp(
    state.blob.scaleY,
    1 - Math.min(0.08, speed * 0.00008) - squeeze * 0.1,
    12,
    dt,
  );
  state.blob.tilt = damp(
    state.blob.tilt,
    clamp(state.blob.vx * 0.0012, -0.26, 0.26),
    10,
    dt,
  );
}

function updatePieces(dt) {
  state.pieces.forEach((piece) => {
    if (piece.sorted) {
      piece.scale = damp(piece.scale, 1, 12, dt);
      piece.rotation = damp(piece.rotation, 0, 14, dt);
      piece.snap = Math.max(0, piece.snap - dt * 3.6);
      return;
    }

    if (state.grabbedId === piece.id) {
      const targetX = state.blob.x + 8;
      const targetY = state.blob.y - 44;
      const slot = slots[piece.id];
      const toSlotX = slot.x - piece.x;
      const toSlotY = slot.y - piece.y;
      const slotDistance = length(toSlotX, toSlotY);
      const snapPull = clamp(1 - slotDistance / 180, 0, 1);

      piece.vx += ((targetX - piece.x) * 22 - piece.vx * 9.8) * dt;
      piece.vy += ((targetY - piece.y) * 22 - piece.vy * 9.8) * dt;
      if (snapPull > 0) {
        piece.vx += toSlotX * (7 + snapPull * 10) * snapPull * dt;
        piece.vy += toSlotY * (7 + snapPull * 10) * snapPull * dt;
        state.slotGlow[piece.id] = Math.max(
          state.slotGlow[piece.id],
          0.18 + snapPull * 0.82,
        );
      }
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.rotation = damp(piece.rotation, state.blob.tilt * 0.55, 12, dt);
      piece.scale = damp(piece.scale, 1.08 + snapPull * 0.05, 10, dt);
      return;
    }

    piece.vy += 36 * dt;
    piece.vx *= Math.exp(-4.4 * dt);
    piece.vy *= Math.exp(-4.4 * dt);
    piece.rotation += piece.rotationVelocity;
    piece.rotationVelocity *= 0.9;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.scale = damp(
      piece.scale,
      state.hoveredId === piece.id ? 1.05 : 1,
      state.hoveredId === piece.id ? 12 : 10,
      dt,
    );
    bounceLoosePiece(piece);
  });
}

function updateParticles(dt) {
  state.puffs = state.puffs.filter((puff) => {
    puff.life -= dt;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= 0.92;
    puff.vy *= 0.92;
    puff.radius += dt * 22;
    puff.alpha *= 0.95;
    return puff.life > 0 && puff.alpha > 0.01;
  });

  state.chips = state.chips.filter((chip) => {
    chip.life -= dt;
    chip.x += chip.vx * dt;
    chip.y += chip.vy * dt;
    chip.vx *= 0.95;
    chip.vy = chip.vy * 0.95 + 20 * dt;
    chip.rotation += chip.spin * dt;
    chip.alpha *= 0.96;
    return chip.life > 0 && chip.alpha > 0.02;
  });

  state.ripples = state.ripples.filter((ripple) => {
    ripple.life -= dt;
    ripple.radius += dt * 110;
    ripple.width = Math.max(0.6, ripple.width - dt * 4.2);
    ripple.alpha *= 0.94;
    return ripple.life > 0 && ripple.alpha > 0.01;
  });
}

function update(dt) {
  state.time += dt;

  if (state.active) {
    updateHoveredPiece();
    updateBlob(dt);
    updatePieces(dt);
  } else {
    state.hoveredId = null;
    state.blob.scaleX = damp(state.blob.scaleX, 1, 8, dt);
    state.blob.scaleY = damp(state.blob.scaleY, 1, 8, dt);
    state.blob.tilt = damp(state.blob.tilt, 0, 8, dt);
  }

  updateParticles(dt);
  updateSlotFeedback(dt);
  updateMessage(dt);
  updateUi();
}

function drawBackground(time) {
  context.fillStyle = "#d8eef1";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255, 255, 255, 0.3)";
  roundedRectPath(context, 54, trayTop, width - 108, trayHeight, 38);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  roundedRectPath(
    context,
    46,
    looseTop - 12,
    width - 92,
    height - looseTop - 36,
    34,
  );
  context.fill();

  context.strokeStyle = "rgba(88, 71, 58, 0.1)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(76, trayTop + trayHeight + 6);
  context.lineTo(width - 76, trayTop + trayHeight + 6);
  context.stroke();

  context.strokeStyle = "rgba(88, 71, 58, 0.06)";
  context.lineWidth = 1;
  for (let row = 0; row < 4; row += 1) {
    const y = looseTop + 48 + row * 84 + Math.sin(time * 0.8 + row) * 4;
    context.beginPath();
    context.moveTo(108, y);
    context.quadraticCurveTo(width * 0.5, y + 8, width - 108, y);
    context.stroke();
  }

  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = 134 + column * 114;
      const y = looseTop + 32 + row * 92;
      context.beginPath();
      context.arc(x, y, 4, 0, tau);
      context.fill();
    }
  }
}

function drawSlots() {
  const grabbedPiece =
    state.grabbedId !== null ? state.pieces[state.grabbedId] : null;

  slots.forEach((slot) => {
    const piece = state.pieces[slot.id];
    const highlight = grabbedPiece && grabbedPiece.id === slot.id;
    const hover = state.hoveredId === slot.id;
    const filled = piece.sorted;
    const pulse = highlight ? 0.5 + Math.sin(state.time * 8) * 0.12 : 0;
    const glow = Math.max(state.slotGlow[slot.id], hover ? 0.14 : 0, pulse);
    const jolt = state.slotJolt[slot.id];

    context.save();
    context.translate(slot.x + Math.sin(state.time * 46) * jolt * 4, slot.y);

    context.fillStyle = filled
      ? "rgba(255, 255, 255, 0.92)"
      : `rgba(255, 255, 255, ${0.66 + glow * 0.14})`;
    roundedRectPath(context, -60, -42, 120, 84, 28);
    context.fill();

    context.strokeStyle = filled
      ? "rgba(88, 71, 58, 0.14)"
      : highlight
        ? hexToRgba(slot.color, 0.52 + glow * 0.26)
        : hexToRgba(slot.color, 0.12 + glow * 0.22);
    context.lineWidth = highlight || hover ? 3 : 2;
    roundedRectPath(context, -60, -42, 120, 84, 28);
    context.stroke();

    context.globalAlpha = filled ? 0.12 : 0.18 + glow * 0.2;
    context.fillStyle = slot.color;
    tracePieceShape(slot.kind, 0.64);
    context.fill();
    context.restore();
  });
}

function drawPieceShadow(piece) {
  context.save();
  context.translate(piece.x, piece.y + 30);
  context.rotate(piece.rotation * 0.4);

  context.fillStyle = piece.sorted
    ? "rgba(88, 71, 58, 0.08)"
    : "rgba(88, 71, 58, 0.12)";

  context.beginPath();
  context.ellipse(0, 0, 34 + piece.scale * 10, 14 + piece.scale * 4, 0, 0, tau);
  context.fill();
  context.restore();
}

function drawPiece(piece) {
  const hovered = state.hoveredId === piece.id;

  context.save();
  context.translate(piece.x, piece.y - piece.snap * 6);
  context.rotate(piece.rotation);
  context.scale(piece.scale, piece.scale);

  context.fillStyle = piece.color;
  tracePieceShape(piece.kind);
  context.fill();

  context.globalAlpha = 0.3;
  context.fillStyle = "#fffaf2";
  context.beginPath();
  context.ellipse(-8, -14, 18, 10, -0.2, 0, tau);
  context.fill();

  context.globalAlpha = 0.18;
  context.fillStyle = "#704f40";
  context.beginPath();
  context.ellipse(18, 18, 12, 8, -0.1, 0, tau);
  context.fill();

  context.globalAlpha = 1;
  context.strokeStyle = "rgba(88, 71, 58, 0.16)";
  context.lineWidth = hovered ? 3 : 2;
  tracePieceShape(piece.kind);
  context.stroke();

  if (hovered) {
    context.strokeStyle = hexToRgba(piece.color, 0.34);
    context.lineWidth = 6;
    tracePieceShape(piece.kind, 1.08);
    context.stroke();
  }

  if (piece.kind === "flower") {
    context.fillStyle = "#fff8ef";
    context.beginPath();
    context.arc(0, 4, 11, 0, tau);
    context.fill();
  }

  context.restore();
}

function drawPuffs() {
  state.puffs.forEach((puff) => {
    context.save();
    context.globalAlpha = puff.alpha;
    context.fillStyle = puff.color;
    context.beginPath();
    context.arc(puff.x, puff.y, puff.radius, 0, tau);
    context.fill();
    context.restore();
  });
}

function drawChips() {
  state.chips.forEach((chip) => {
    context.save();
    context.globalAlpha = chip.alpha;
    context.translate(chip.x, chip.y);
    context.rotate(chip.rotation);
    context.fillStyle = chip.color;
    roundedRectPath(
      context,
      -chip.width * 0.5,
      -chip.height * 0.5,
      chip.width,
      chip.height,
      chip.height * 0.45,
    );
    context.fill();
    context.restore();
  });
}

function drawRipples() {
  state.ripples.forEach((ripple) => {
    context.save();
    context.globalAlpha = ripple.alpha;
    context.strokeStyle = ripple.color;
    context.lineWidth = ripple.width;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius, 0, tau);
    context.stroke();
    context.restore();
  });
}

function drawTarget() {
  if (!state.active) {
    return;
  }

  context.save();
  context.translate(state.target.x, state.target.y);
  const hoveredPiece =
    state.hoveredId !== null ? state.pieces[state.hoveredId] : null;

  context.globalAlpha =
    state.grabbedId !== null ? 0.16 : hoveredPiece ? 0.28 : 0.22;
  context.fillStyle = hoveredPiece ? hoveredPiece.color : "#fff8ef";
  context.beginPath();
  context.arc(0, 0, state.grabbedId !== null ? 16 : 18, 0, tau);
  context.fill();

  context.globalAlpha = 1;
  context.strokeStyle = hoveredPiece
    ? hexToRgba(hoveredPiece.color, 0.34)
    : "rgba(88, 71, 58, 0.14)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, state.grabbedId !== null ? 16 : 18, 0, tau);
  context.stroke();
  context.restore();
}

function drawBlobShadow() {
  context.save();
  context.translate(state.blob.x, state.blob.y + 34);
  context.fillStyle = "rgba(88, 71, 58, 0.14)";
  context.beginPath();
  context.ellipse(
    0,
    0,
    42 + Math.abs(state.blob.vx) * 0.03,
    16 + Math.abs(state.blob.vy) * 0.01,
    0,
    0,
    tau,
  );
  context.fill();
  context.restore();
}

function drawBlob() {
  context.save();
  context.translate(state.blob.x, state.blob.y);
  context.rotate(state.blob.tilt);
  context.scale(state.blob.scaleX, state.blob.scaleY);

  context.fillStyle = "#fff8ef";
  context.beginPath();
  context.moveTo(-42, 4);
  context.bezierCurveTo(-44, -28, -18, -44, 14, -44);
  context.bezierCurveTo(42, -44, 48, -16, 40, 14);
  context.bezierCurveTo(32, 40, -4, 44, -28, 32);
  context.bezierCurveTo(-40, 26, -44, 18, -42, 4);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.28;
  context.fillStyle = "#ef7b63";
  context.beginPath();
  context.ellipse(8, 18, 22, 10, -0.08, 0, tau);
  context.fill();

  context.globalAlpha = 0.38;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(-2, -14, 16, 8, -0.24, 0, tau);
  context.fill();

  context.globalAlpha = 1;
  context.strokeStyle = "rgba(88, 71, 58, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-42, 4);
  context.bezierCurveTo(-44, -28, -18, -44, 14, -44);
  context.bezierCurveTo(42, -44, 48, -16, 40, 14);
  context.bezierCurveTo(32, 40, -4, 44, -28, 32);
  context.bezierCurveTo(-40, 26, -44, 18, -42, 4);
  context.closePath();
  context.stroke();
  context.restore();
}

function draw(timestamp) {
  drawBackground(timestamp / 1000);
  drawSlots();

  const loosePieces = state.pieces.filter(
    (piece) => !piece.sorted && piece.id !== state.grabbedId,
  );
  const sortedPieces = state.pieces.filter((piece) => piece.sorted);
  const grabbedPiece =
    state.grabbedId !== null ? state.pieces[state.grabbedId] : null;

  sortedPieces.forEach(drawPieceShadow);
  sortedPieces.forEach(drawPiece);
  loosePieces.forEach(drawPieceShadow);
  drawPuffs();
  drawRipples();
  drawChips();
  loosePieces.forEach(drawPiece);
  drawTarget();
  drawBlobShadow();
  drawBlob();

  if (grabbedPiece) {
    drawPieceShadow(grabbedPiece);
    drawPiece(grabbedPiece);
  }
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

  resetRound();
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
  releasePiece();
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    if (!event.touches[0]) {
      return;
    }

    event.preventDefault();
    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
    beginHold();
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!event.touches[0]) {
      return;
    }

    event.preventDefault();
    moveTargetTo(event.touches[0].clientX, event.touches[0].clientY);
  },
  { passive: false },
);

window.addEventListener("touchend", () => {
  releasePiece();
});

window.addEventListener("touchcancel", () => {
  releasePiece();
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

  if (key === " " && !event.repeat) {
    state.keys.hold = true;
    beginHold();
    event.preventDefault();
  }

  if (key === "enter") {
    startOrReset();
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
    releasePiece();
    event.preventDefault();
  }
});

startButton.addEventListener("click", startOrReset);
overlayButton.addEventListener("click", startOrReset);

updateUi();
setOverlay(
  "ならべなおし",
  "散らばった小物を、それぞれのくぼみに戻します。",
  "はじめる",
);

requestAnimationFrame((timestamp) => {
  state.lastTick = timestamp;
  draw(timestamp);
  requestAnimationFrame(tick);
});
