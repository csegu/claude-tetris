'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#f06292', '#ffa726', '#7e57c2', '#26c6da', '#fff176'],
  },
  neon: {
    colors: [null, '#00e5ff', '#faff00', '#e100ff', '#00ff85', '#ff1744', '#2979ff', '#ff9100', '#ff2079', '#ff6d00', '#7c4dff', '#1de9b6', '#ffffff'],
  },
  pastel: {
    colors: [null, '#aee3e8', '#fff0b3', '#dcc6f5', '#c3ecc3', '#ffc4c9', '#bcd9ff', '#ffd9ac', '#f9c6e0', '#ffe0b2', '#d1c4e9', '#b2ebf2', '#fff9c4'],
  },
  pixel: {
    colors: [null, '#00b8d4', '#ffd600', '#aa00ff', '#00c853', '#d50000', '#2962ff', '#ff6d00', '#c51162', '#ff8f00', '#6a1b9a', '#00acc1', '#ffffff'],
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // O-frame (marco hueco 3x3)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + pentominó
  [[10,0,10],[10,10,10]],                     // U pentominó
  [[0,11],[11,11],[0,11],[0,11]],             // Y pentominó
  [[12]],                                      // 1x1 (recompensa tras un Tetris)
];

const PENTOMINO_TYPES = [9, 10, 11];
const PENTOMINO_CHANCE = 0.12;
const REWARD_PIECE = 12;

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayStats = document.getElementById('overlay-stats');
const newRecordForm = document.getElementById('new-record-form');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayRecordsList = document.getElementById('overlay-records-list');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuView = document.getElementById('pause-menu-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, baseLevel, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId, pendingReward;
let gridLineColor = '#22222e';
let skin = 'retro';

const RECORDS_KEY = 'tetris-records';

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY));
    return {
      scores: Array.isArray(parsed && parsed.scores) ? parsed.scores : [],
      bestCombo: (parsed && parsed.bestCombo) || 0,
      maxLines: (parsed && parsed.maxLines) || 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecordsToStorage() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

let records = loadRecords();

function qualifiesForTop(scoreVal) {
  if (scoreVal <= 0) return false;
  if (records.scores.length < 5) return true;
  return scoreVal > records.scores[records.scores.length - 1].score;
}

function addRecord(name, scoreVal, linesVal, comboVal) {
  const entry = { name: name || 'AAA', score: scoreVal, lines: linesVal, combo: comboVal };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, 5);
  saveRecordsToStorage();
  return entry;
}

function updateGlobalStats(linesVal, comboVal) {
  let changed = false;
  if (comboVal > records.bestCombo) { records.bestCombo = comboVal; changed = true; }
  if (linesVal > records.maxLines) { records.maxLines = linesVal; changed = true; }
  if (changed) saveRecordsToStorage();
}

function renderRecordsList(container, highlightEntry) {
  container.innerHTML = '';
  if (records.scores.length === 0) {
    const li = document.createElement('li');
    li.className = 'records-empty';
    li.textContent = 'Sin records aún';
    container.appendChild(li);
    return;
  }
  records.scores.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'records-item';
    if (r === highlightEntry) li.classList.add('records-highlight');
    const rank = document.createElement('span');
    rank.className = 'records-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'records-name';
    name.textContent = r.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'records-score';
    scoreSpan.textContent = r.score.toLocaleString();
    li.append(rank, name, scoreSpan);
    container.appendChild(li);
  });
}

function renderSidebarRecords() {
  renderRecordsList(recordsListEl, null);
  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  records = { scores: [], bestCombo: 0, maxLines: 0 };
  saveRecordsToStorage();
  renderSidebarRecords();
});

function submitRecord() {
  const name = playerNameInput.value.trim().slice(0, 12) || 'AAA';
  const entry = addRecord(name, score, lines, maxCombo);
  newRecordForm.classList.add('hidden');
  renderRecordsList(overlayRecordsList, entry);
  renderSidebarRecords();
}

saveRecordBtn.addEventListener('click', submitRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitRecord();
});

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;
const SKIN_KEY = 'tetris-skin';

function applyTheme(theme) {
  document.body.classList.toggle('light-mode', theme === 'light');
  themeToggle.checked = theme === 'light';
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

function populateStartLevelOptions() {
  for (let i = 1; i <= MAX_START_LEVEL; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    startLevelSelect.appendChild(option);
  }
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevelSelect.value = (saved >= 1 && saved <= MAX_START_LEVEL) ? saved : 1;
}

startLevelSelect.addEventListener('change', () => {
  localStorage.setItem(START_LEVEL_KEY, startLevelSelect.value);
});

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  skinSelect.value = skin;
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${skin}`);
  if (current) {
    draw();
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved || 'retro');
}

skinSelect.addEventListener('change', () => {
  localStorage.setItem(SKIN_KEY, skinSelect.value);
  applySkin(skinSelect.value);
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(forceType) {
  let type;
  if (forceType) {
    type = forceType;
  } else if (Math.random() < PENTOMINO_CHANCE) {
    type = PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)];
  } else {
    type = Math.floor(Math.random() * 8) + 1;
  }
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (cleared === 4) pendingReward = true;
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = pendingReward ? randomPiece(REWARD_PIECE) : randomPiece();
  pendingReward = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + percent);
  const g = clamp(((num >> 8) & 0xff) + percent);
  const b = clamp((num & 0xff) + percent);
  return `rgb(${r}, ${g}, ${b})`;
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, color, size) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.save();
  context.fillStyle = 'rgba(5,5,12,0.9)';
  context.fillRect(px, py, s, s);
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, s - 2, s - 2);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.globalAlpha *= 0.3;
  context.fillRect(px + 2, py + 2, s - 4, s - 4);
  context.restore();
}

function drawBlockPastel(context, x, y, color, size) {
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  roundedRectPath(context, px, py, s, s, 6);
  context.fillStyle = color;
  context.fill();
  roundedRectPath(context, px, py, s, s * 0.4, 4);
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.fill();
}

function drawBlockPixel(context, x, y, color, size) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  const cell = Math.max(2, Math.floor(s / 6));
  context.fillStyle = shadeColor(color, -30);
  for (let i = 0; i < s; i += cell * 2) {
    for (let j = 0; j < s; j += cell * 2) {
      context.fillRect(px + i, py + j, cell, cell);
      context.fillRect(px + i + cell, py + j + cell, cell, cell);
    }
  }
  context.strokeStyle = shadeColor(color, -50);
  context.lineWidth = 2;
  context.strokeRect(px, py, s, s);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS[skin].colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  if (skin === 'neon') drawBlockNeon(context, x, y, color, size);
  else if (skin === 'pastel') drawBlockPastel(context, x, y, color, size);
  else if (skin === 'pixel') drawBlockPixel(context, x, y, color, size);
  else drawBlockRetro(context, x, y, color, size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin === 'neon' ? 'rgba(0,229,255,0.15)' : gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const cols = nextCanvas.width / NB;
  const rows = nextCanvas.height / NB;
  const offX = (cols - shape[0].length) / 2;
  const offY = (rows - shape.length) / 2;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateGlobalStats(lines, maxCombo);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Líneas: ${lines} · Mejor combo: ${maxCombo}`;
  if (qualifiesForTop(score)) {
    newRecordForm.classList.remove('hidden');
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    newRecordForm.classList.add('hidden');
  }
  renderRecordsList(overlayRecordsList, null);
  renderSidebarRecords();
  overlay.classList.remove('hidden');
}

function showPauseMenuView() {
  pauseControlsView.classList.add('hidden');
  pauseMenuView.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenuView();
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = parseInt(startLevelSelect.value, 10) || 1;
  level = baseLevel;
  combo = 0;
  maxCombo = 0;
  pendingReward = false;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlayStats.textContent = '';
  newRecordForm.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  showPauseMenuView();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', () => {
  init();
});

showControlsBtn.addEventListener('click', () => {
  pauseMenuView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});

backBtn.addEventListener('click', showPauseMenuView);

initTheme();
populateStartLevelOptions();
initStartLevel();
renderSidebarRecords();
initSkin();
init();
