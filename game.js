// ============================================================================
// 小朋友下樓梯 NS-SHAFT ONLINE ⚡ 1997 1:1 復刻 + 手動上傳 + 戰績存圖 + LINE分享
// ============================================================================

const canvas = document.getElementById('shaftCanvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;  // 480
const H = canvas.height; // 600
const WALL_W = 18;
const MAX_HP = 12;
const FIXED_MAP_SEED = 20261022;
const PLAT_GAP_Y = 92;

// Google Firebase Realtime Database URL (貼上你的 Firebase Realtime Database 網址即可全服同步！)
// 例如: 'https://ns-shaft-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_DB_URL = 'https://ns-shaft-5e71f-default-rtdb.firebaseio.com';

// DOM Elements
const lifeBarsEl = document.getElementById('lifeBars');
const hudHpText = document.getElementById('hudHpText');
const hudFloor = document.getElementById('hudFloor');
const hudBestFloor = document.getElementById('hudBestFloor');
const gameOverModal = document.getElementById('gameOverModal');
const imgPreviewModal = document.getElementById('imgPreviewModal');
const generatedCardImg = document.getElementById('generatedCardImg');
const playerNameInput = document.getElementById('playerName');
const modalNameInput = document.getElementById('modalNameInput');
const btnUploadScore = document.getElementById('btnUploadScore');
const btnSeedMode = document.getElementById('btnSeedMode');
const toggleGhostInput = document.getElementById('toggleGhost');
const ghostStatusLabel = document.getElementById('ghostStatusLabel');
const leaderboardList = document.getElementById('leaderboardList');
const toastEl = document.getElementById('toast');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// Sync saved player name between sidebar and modal
if (localStorage.getItem('nss_name')) playerNameInput.value = localStorage.getItem('nss_name');
modalNameInput.value = playerNameInput.value;

function syncInputsFromSidebar() {
  modalNameInput.value = playerNameInput.value;
  localStorage.setItem('nss_name', playerNameInput.value.trim());
}
function syncInputsFromModal() {
  playerNameInput.value = modalNameInput.value;
  localStorage.setItem('nss_name', modalNameInput.value.trim());
}
playerNameInput.addEventListener('input', syncInputsFromSidebar);
modalNameInput.addEventListener('input', syncInputsFromModal);

// ============================================================================
// Title / Achievement System (稱號系統)
// ============================================================================
function computeTitle(floor, cause) {
  let rankTitle = '🌱 剛進電腦教室的菜鳥';
  if (floor >= 100) rankTitle = '👑 下100層的傳說真男人';
  else if (floor >= 60) rankTitle = '🔥 地下深淵統治者';
  else if (floor >= 30) rankTitle = '⚡ 電腦課風雲人物';
  else if (floor >= 15) rankTitle = '👟 下樓梯熟練工';
  else if (floor >= 5) rankTitle = '🎒 偷玩電腦的小學生';

  if (cause.includes('彈簧')) return `${rankTitle}・天花板刺蝟`;
  if (cause.includes('尖刺地板')) return `${rankTitle}・鐵布衫苦主`;
  if (cause.includes('深淵')) return `${rankTitle}・自由落體大師`;
  return rankTitle;
}

// ============================================================================
// Classic Arcade Sound Synthesizer (Web Audio API)
// ============================================================================
class RetroAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  step() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }
  spring() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.16);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }
  flip() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }
  hurt() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [380, 295].forEach(freq => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(95, now + 0.28);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    });
  }
  levelUp() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      g.gain.setValueAtTime(0.14, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.19);
    });
  }
  gameOver() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [400, 350, 300, 180].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.11);
      g.gain.setValueAtTime(0.24, now + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.26);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.28);
    });
  }
}

const sfx = new RetroAudio();

// ============================================================================
// Seeded PRNG (Supports both Synchronized Daily Seed & Random Seed Mode)
// ============================================================================
let useFixedSeed = true;
let activeSeed = FIXED_MAP_SEED;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createPlatform(idx) {
  const rng = mulberry32(activeSeed + idx * 9973);
  const y = 260 + idx * PLAT_GAP_Y;
  const w = 104;
  const h = 16;

  if (idx === 0) {
    return {
      idx,
      x: W / 2 - w / 2,
      y,
      w,
      h,
      type: 'normal',
      touched: false,
      flipTimer: 0,
      flipped: false,
      springCompress: 0,
      passThrough: false
    };
  }

  const x = Math.floor(WALL_W + 6 + rng() * (W - WALL_W * 2 - 12 - w));
  const r = rng();

  let type = 'normal';
  const spikeChance = Math.min(0.24, 0.13 + idx * 0.0003);

  if (r < spikeChance) type = 'spike';
  else if (r < spikeChance + 0.10) type = 'trampoline';
  else if (r < spikeChance + 0.20) type = 'conveyor_left';
  else if (r < spikeChance + 0.30) type = 'conveyor_right';
  else if (r < spikeChance + 0.40) type = 'fake';

  if (type === 'spike' && idx > 1) {
    const prevRng = mulberry32(activeSeed + (idx - 1) * 9973);
    prevRng();
    if (prevRng() < spikeChance) {
      type = 'normal';
    }
  }

  return {
    idx,
    x,
    y,
    w,
    h,
    type,
    touched: false,
    flipTimer: 0,
    flipped: false,
    springCompress: 0,
    passThrough: false
  };
}

// ============================================================================
// Game State & Player Object
// ============================================================================
let platforms = [];
let nextPlatIdx = 0;

const player = {
  x: W / 2,
  y: 220,
  vx: 0,
  vy: 0,
  w: 26,
  h: 32,
  hp: MAX_HP,
  grounded: false,
  currentPlat: null,
  facing: 0,
  walkCycle: 0,
  invulnTimer: 0
};

let cameraY = 0;
let scrollSpeed = 105;
let currentFloor = 1;
let bestFloor = Number(localStorage.getItem('nss_best_floor') || 1);
let elapsedMs = 0;
let isGameOver = false;
let lastCause = '極限挑戰中';
let lastTitle = '👟 下樓梯挑戰者';
let lastUploadedRank = null;
let hasUploadedCurrentRun = false;
let deathSnapshotCanvas = null; // Captures the exact moment of death for the Share Card!
let redFlashAlpha = 0;
let screenShake = 0;

// Ghost Recording & Playback
let recordedGhost = [];
let ghostTimer = 0;
let topGhost = null;
let selectedGhostId = null;

// Online Data
let leaderboardData = {
  records: [],
  deaths: [],
  stats: { totalGames: 0, maxFloorEver: 1, totalFloorsDescended: 0 }
};

const particles = [];
const floatingTexts = [];
const keys = { left: false, right: false };

// ============================================================================
// HUD & Visual Helpers
// ============================================================================
function formatFloor(f) {
  return 'B' + String(f).padStart(3, '0');
}

function updateLifeHUD() {
  hudHpText.textContent = `${player.hp} / ${MAX_HP}`;
  lifeBarsEl.innerHTML = '';
  for (let i = 0; i < MAX_HP; i++) {
    const pip = document.createElement('div');
    let cls = 'life-pip';
    if (i < player.hp) {
      cls += player.hp <= 4 ? ' danger' : ' filled';
    }
    pip.className = cls;
    lifeBarsEl.appendChild(pip);
  }
}

function addFloatingText(x, y, text, color = '#facc15') {
  floatingTexts.push({ x, y, text, color, life: 0.95, vy: -45 });
}

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 160;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 2 + Math.random() * 3,
      color,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6
    });
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2800);
}

// ============================================================================
// Online Leaderboard API & Manual Upload (With GitHub Pages Static Fallback!)
// ============================================================================
function getLocalFallbackDB() {
  try {
    const raw = localStorage.getItem('nss_static_db');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Default seed records for static GitHub Pages mode
  const simGhost = [];
  let gx = 240, gy = 230, cam = 0;
  for (let t = 0; t < 480; t++) {
    cam += (105 + t * 0.12) * 0.1;
    const idx = Math.max(0, Math.round((gy - 220) / PLAT_GAP_Y));
    let p = createPlatform(idx);
    if (p.type === 'spike') p = createPlatform(idx + 1);
    const tx = p.x + p.w / 2;
    gx += (tx - gx) * 0.38;
    gy = Math.max(cam + 90, Math.min(cam + 460, p.y - 16));
    simGhost.push([Math.round(gx), Math.round(gy), tx > gx + 3 ? 1 : tx < gx - 3 ? -1 : 0]);
  }

  return {
    records: [
      { id: 'seed-1', name: '⚡電腦課之神', floor: 64, timeMs: 68400, title: '🔥 地下深淵統治者', cause: '被彈簧床送去撞天花板', hasGhost: true, ghost: simGhost },
      { id: 'seed-2', name: '七年級老司機', floor: 48, timeMs: 51200, title: '⚡ 電腦課風雲人物', cause: '踩到尖刺地板失血過多', hasGhost: false, ghost: [] },
      { id: 'seed-3', name: '阿凱不想上班', floor: 31, timeMs: 34900, title: '⚡ 電腦課風雲人物', cause: '墜入無底深淵', hasGhost: false, ghost: [] },
      { id: 'seed-4', name: '小明', floor: 18, timeMs: 21500, title: '👟 下樓梯熟練工', cause: '被天花板尖刺夾扁', hasGhost: false, ghost: [] }
    ],
    stats: { totalGames: 218, maxFloorEver: 64, totalFloorsDescended: 4890 }
  };
}

// Check if URL has a shared friend challenge (?c=Name&f=42&t=38500&g=...)
function importUrlChallengeIfPresent() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cName = params.get('c');
    const cFloor = Number(params.get('f'));
    if (!cName || !cFloor) return;
    const cTime = Number(params.get('t')) || cFloor * 1100;
    const cCause = params.get('d') || '極限挑戰';
    const cTitle = computeTitle(cFloor, cCause);
    let cGhost = [];
    const gParam = params.get('g');
    if (gParam) {
      cGhost = gParam.split(';').map(pair => {
        const [x, y, dir] = pair.split(',').map(Number);
        return [x || 240, y || 230, dir || 0];
      });
    }
    const db = getLocalFallbackDB();
    const challengeId = 'friend-' + cName + '-' + cFloor;
    if (!db.records.some(r => r.id === challengeId)) {
      db.records.push({
        id: challengeId,
        name: `🔥${cName}`,
        floor: cFloor,
        timeMs: cTime,
        title: cTitle,
        cause: cCause,
        hasGhost: cGhost.length > 5,
        ghost: cGhost
      });
      db.records.sort((a, b) => b.floor - a.floor || b.timeMs - a.timeMs);
      if (cFloor > db.stats.maxFloorEver) db.stats.maxFloorEver = cFloor;
      localStorage.setItem('nss_static_db', JSON.stringify(db));
    }
    selectedGhostId = challengeId;
    setTimeout(() => showToast(`🔥 收到來自【${cName} (地下 B${String(cFloor).padStart(3, '0')} 層)】的殘影挑戰！`), 400);
  } catch (e) {}
}

function applyStaticFallbackData(ghostId) {
  const db = getLocalFallbackDB();
  let targetGhost = db.records.find(r => r.id === ghostId && Array.isArray(r.ghost) && r.ghost.length > 5);
  if (!targetGhost) targetGhost = db.records.find(r => Array.isArray(r.ghost) && r.ghost.length > 5);

  leaderboardData = {
    records: db.records.map(r => ({ ...r, hasGhost: Array.isArray(r.ghost) && r.ghost.length > 5 })),
    deaths: [],
    stats: db.stats
  };
  if (targetGhost) {
    topGhost = { id: targetGhost.id, name: targetGhost.name, floor: targetGhost.floor, frames: targetGhost.ghost };
    selectedGhostId = targetGhost.id;
    ghostStatusLabel.textContent = `👻 對戰殘影：${topGhost.name} (B${topGhost.floor})`;
  }
  renderLeaderboard();
}

async function fetchFromFirebase(ghostId) {
  const baseUrl = FIREBASE_DB_URL.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/records.json`);
  if (!res.ok) throw new Error('Firebase read error');
  const raw = await res.json();

  let records = [];
  if (raw && typeof raw === 'object') {
    records = Object.entries(raw).map(([key, val]) => ({
      id: key,
      ...val,
      hasGhost: Array.isArray(val.ghost) && val.ghost.length > 5
    }));
  }

  // If Firebase DB is brand new & empty, seed initial default records so players have a ghost to race!
  if (records.length === 0) {
    const seedDb = getLocalFallbackDB();
    for (const rec of seedDb.records) {
      await fetch(`${baseUrl}/records.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec)
      }).catch(() => {});
    }
    records = seedDb.records;
  }

  records.sort((a, b) => (b.floor || 0) - (a.floor || 0) || (b.timeMs || 0) - (a.timeMs || 0));

  const totalGames = records.length;
  const maxFloorEver = records.reduce((m, r) => Math.max(m, r.floor || 1), 1);
  const totalFloorsDescended = records.reduce((s, r) => s + (r.floor || 0), 0);

  let targetGhostRec = null;
  if (ghostId) {
    targetGhostRec = records.find(r => r.id === ghostId && Array.isArray(r.ghost) && r.ghost.length > 5);
  }
  if (!targetGhostRec) {
    targetGhostRec = records.find(r => Array.isArray(r.ghost) && r.ghost.length > 5);
  }

  leaderboardData = {
    records: records.slice(0, 20),
    deaths: [],
    stats: { totalGames, maxFloorEver, totalFloorsDescended }
  };

  if (targetGhostRec) {
    topGhost = {
      id: targetGhostRec.id,
      name: targetGhostRec.name,
      floor: targetGhostRec.floor,
      frames: targetGhostRec.ghost
    };
    selectedGhostId = targetGhostRec.id;
    ghostStatusLabel.textContent = `👻 對戰殘影：${topGhost.name} (B${topGhost.floor})`;
  }
  renderLeaderboard();
}

async function fetchLeaderboard(ghostId = selectedGhostId) {
  if (FIREBASE_DB_URL) {
    try {
      await fetchFromFirebase(ghostId);
      return;
    } catch (err) {
      console.warn('[Johnny_LOG] Firebase fetch fallback:', err);
    }
  }
  try {
    const url = ghostId ? `/api/leaderboard?ghostId=${encodeURIComponent(ghostId)}` : '/api/leaderboard';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Static mode');
    const data = await res.json();
    leaderboardData = data;
    if (data.topGhost && Array.isArray(data.topGhost.frames)) {
      topGhost = data.topGhost;
      selectedGhostId = data.topGhost.id || null;
      ghostStatusLabel.textContent = `👻 對戰殘影：${topGhost.name} (B${topGhost.floor})`;
    }
    renderLeaderboard();
  } catch (err) {
    applyStaticFallbackData(ghostId);
  }
}

async function handleManualUpload() {
  if (hasUploadedCurrentRun) return;
  syncInputsFromModal();

  btnUploadScore.disabled = true;
  btnUploadScore.textContent = '⏳ 正在上傳成績與殘影...';

  const payload = {
    name: modalNameInput.value.trim() || '無名小朋友',
    floor: currentFloor,
    timeMs: Math.round(elapsedMs),
    cause: lastCause,
    title: lastTitle,
    deathX: Math.round(player.x),
    deathY: Math.round(player.y),
    date: new Date().toISOString(),
    ghost: useFixedSeed ? recordedGhost : []
  };

  // 1. If Google Firebase Realtime Database is configured, upload directly to Firebase!
  if (FIREBASE_DB_URL) {
    try {
      const baseUrl = FIREBASE_DB_URL.replace(/\/+$/, '');
      const postRes = await fetch(`${baseUrl}/records.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!postRes.ok) throw new Error('Firebase POST failed');
      const postData = await postRes.json();
      const newKey = postData.name;
      hasUploadedCurrentRun = true;
      selectedGhostId = newKey;
      await fetchFromFirebase(newKey);
      const rank = leaderboardData.records.findIndex(r => r.id === newKey) + 1 || 1;
      lastUploadedRank = rank;
      document.getElementById('modalRankStat').textContent = `#${rank}`;
      btnUploadScore.textContent = `✅ 已同步至全服雲端排行榜！(第 #${rank} 名)`;
      showToast(`🏆 成績已同步至 Google Firebase 全服第 #${rank} 名！`);
      return;
    } catch (err) {
      console.warn('[Johnny_LOG] Firebase upload error:', err);
    }
  }

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Static mode');
    const result = await res.json();
    hasUploadedCurrentRun = true;
    lastUploadedRank = result.rank;
    document.getElementById('modalRankStat').textContent = result.rank ? `#${result.rank}` : '已上榜';
    btnUploadScore.textContent = `✅ 已成功上傳排行榜！(全服第 #${result.rank || 1} 名)`;
    showToast(`🏆 成績已上傳！你目前排全服第 #${result.rank || 1} 名！`);
    await fetchLeaderboard(selectedGhostId);
  } catch (err) {
    // Fallback for static GitHub Pages hosting
    const db = getLocalFallbackDB();
    const newId = 'local-' + Date.now();
    db.records.push({
      id: newId,
      name: payload.name,
      floor: payload.floor,
      timeMs: payload.timeMs,
      title: payload.title,
      cause: payload.cause,
      hasGhost: payload.ghost.length > 5,
      ghost: payload.ghost
    });
    db.records.sort((a, b) => b.floor - a.floor || b.timeMs - a.timeMs);
    db.stats.totalGames += 1;
    db.stats.totalFloorsDescended += payload.floor;
    if (payload.floor > db.stats.maxFloorEver) db.stats.maxFloorEver = payload.floor;
    const rank = db.records.findIndex(r => r.id === newId) + 1;
    localStorage.setItem('nss_static_db', JSON.stringify(db));

    hasUploadedCurrentRun = true;
    lastUploadedRank = rank;
    selectedGhostId = newId;
    document.getElementById('modalRankStat').textContent = `#${rank}`;
    btnUploadScore.textContent = `✅ 已登入排行榜！(第 #${rank} 名)`;
    showToast(`🏆 成績已登入排行榜第 #${rank} 名！點 LINE 分享可把殘影傳給朋友挑戰！`);
    applyStaticFallbackData(newId);
  }
}

function renderLeaderboard() {
  document.getElementById('statGames').textContent = leaderboardData.stats?.totalGames ?? 0;
  document.getElementById('statMaxFloor').textContent = formatFloor(leaderboardData.stats?.maxFloorEver ?? 1);
  document.getElementById('statTotalFloors').textContent = leaderboardData.stats?.totalFloorsDescended ?? 0;

  leaderboardList.innerHTML = '';
  const list = leaderboardData.records || [];

  if (list.length === 0) {
    leaderboardList.innerHTML = '<div class="loading-text">暫無紀錄，快成為第一名！</div>';
    return;
  }

  list.slice(0, 12).forEach((item, idx) => {
    const rank = idx + 1;
    const isSelectedGhost = topGhost && item.id === topGhost.id;
    const row = document.createElement('div');
    row.className = [
      'lb-item',
      rank === 1 ? 'top-1' : '',
      item.hasGhost ? 'has-ghost' : '',
      isSelectedGhost ? 'active-ghost' : ''
    ].filter(Boolean).join(' ');

    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    row.innerHTML = `
      <div class="lb-left">
        <span class="lb-rank">${medal}</span>
        <div class="lb-name-wrap">
          <span class="lb-name"></span>
          <span class="lb-cause"></span>
        </div>
      </div>
      <div class="lb-right">
        <span class="lb-score">${formatFloor(item.floor)} 層</span>
        <span class="lb-meta">${(item.timeMs / 1000).toFixed(1)}s ${item.hasGhost ? '👻點我PK' : ''}</span>
      </div>
    `;
    row.querySelector('.lb-name').textContent = item.name;
    row.querySelector('.lb-cause').textContent = item.title ? `${item.title} (${item.cause})` : item.cause;

    if (item.hasGhost) {
      row.addEventListener('click', () => {
        selectedGhostId = item.id;
        toggleGhostInput.checked = true;
        fetchLeaderboard(item.id);
        showToast(`👻 已切換對戰殘影為：${item.name} (B${item.floor}層)！`);
      });
    }

    leaderboardList.appendChild(row);
  });
}

// ============================================================================
// Generate Retro Arcade Share Image Card (PNG) + LINE Share
// ============================================================================
let latestCardBlob = null;

function generateShareCardCanvas() {
  const card = document.createElement('canvas');
  card.width = 600;
  card.height = 780;
  const c = card.getContext('2d');

  // 1. Deep Cyber-Arcade Gradient Background
  const grad = c.createLinearGradient(0, 0, 0, card.height);
  grad.addColorStop(0, '#0b132b');
  grad.addColorStop(0.5, '#111936');
  grad.addColorStop(1, '#060913');
  c.fillStyle = grad;
  c.fillRect(0, 0, card.width, card.height);

  // Subtle grid lines
  c.strokeStyle = 'rgba(56, 189, 248, 0.07)';
  c.lineWidth = 1;
  for (let x = 0; x < card.width; x += 40) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, card.height); c.stroke();
  }
  for (let y = 0; y < card.height; y += 40) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(card.width, y); c.stroke();
  }

  // Outer Neon Border
  c.strokeStyle = '#facc15';
  c.lineWidth = 4;
  c.strokeRect(14, 14, card.width - 28, card.height - 28);

  // 2. Header Banner
  c.fillStyle = '#facc15';
  c.font = '900 32px "Segoe UI", "Noto Sans TC", sans-serif';
  c.textAlign = 'center';
  c.fillText('🏃 小朋友下樓梯 NS-SHAFT', card.width / 2, 66);

  c.fillStyle = '#38bdf8';
  c.font = '700 15px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText('1997 經典復刻 // 全服幽靈殘影連線版', card.width / 2, 92);

  // 3. Player Score Box
  c.fillStyle = 'rgba(24, 33, 58, 0.92)';
  c.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(36, 114, card.width - 72, 185, 14);
  c.fill();
  c.stroke();

  const name = (modalNameInput.value || playerNameInput.value || '無名小朋友').trim();
  const floorToShow = isGameOver ? currentFloor : Math.max(currentFloor, bestFloor);
  const titleToShow = isGameOver ? lastTitle : computeTitle(floorToShow, lastCause);
  const rankStr = lastUploadedRank ? `全服排行 #${lastUploadedRank}` : `個人最高 ${formatFloor(bestFloor)}`;

  c.fillStyle = '#cbd5e1';
  c.font = '700 18px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText(`挑戰者：${name}   |   ${rankStr}`, card.width / 2, 148);

  // Huge Floor Depth Number
  c.fillStyle = '#facc15';
  c.font = '900 64px "Segoe UI", sans-serif';
  c.fillText(`地下 ${formatFloor(floorToShow)} 層`, card.width / 2, 218);

  // Earned Title Pill
  c.fillStyle = '#e9d5ff';
  c.font = '800 18px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText(`🏅 稱號：${titleToShow}`, card.width / 2, 256);

  // Cause of death
  c.fillStyle = '#fda4af';
  c.font = '700 15px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText(`💀 死因：${lastCause}`, card.width / 2, 285);

  // 4. Live Gameplay Death Snapshot (Framed in middle!)
  const snapSource = deathSnapshotCanvas || canvas;
  const snapW = 310;
  const snapH = 385;
  const snapX = (card.width - snapW) / 2;
  const snapY = 318;

  c.save();
  c.strokeStyle = '#38bdf8';
  c.lineWidth = 3;
  c.strokeRect(snapX - 3, snapY - 3, snapW + 6, snapH + 6);
  c.drawImage(snapSource, 0, 0, snapSource.width, snapSource.height, snapX, snapY, snapW, snapH);
  c.restore();

  // 5. Footer Challenge Call-to-Action
  c.fillStyle = '#22c55e';
  c.font = '900 18px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText('🔥 是男人就下 100 層！你敢來跟我的幽靈殘影 PK 嗎？', card.width / 2, 738);

  return card;
}

function openImageCardPreview() {
  const cardCanvas = generateShareCardCanvas();
  const dataUrl = cardCanvas.toDataURL('image/png');
  generatedCardImg.src = dataUrl;
  cardCanvas.toBlob(blob => {
    latestCardBlob = blob;
  }, 'image/png');
  imgPreviewModal.classList.remove('hidden');
}

function downloadCardPng() {
  const cardCanvas = generateShareCardCanvas();
  const floorToShow = isGameOver ? currentFloor : Math.max(currentFloor, bestFloor);
  const a = document.createElement('a');
  a.href = cardCanvas.toDataURL('image/png');
  a.download = `小朋友下樓梯-${formatFloor(floorToShow)}層.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('💾 戰績炫耀圖已下載！');
}

async function nativeShareCardImage() {
  if (!latestCardBlob) {
    const cardCanvas = generateShareCardCanvas();
    await new Promise(r => cardCanvas.toBlob(b => { latestCardBlob = b; r(); }, 'image/png'));
  }
  const floorToShow = isGameOver ? currentFloor : Math.max(currentFloor, bestFloor);
  const file = new File([latestCardBlob], `ns-shaft-${formatFloor(floorToShow)}.png`, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: '小朋友下樓梯 NS-SHAFT 戰績',
        text: buildShareMessage(),
        files: [file]
      });
      return;
    } catch (e) {
      // User cancelled or fallback
    }
  }
  downloadCardPng();
}

function buildShareMessage() {
  const name = (modalNameInput.value || playerNameInput.value || '無名小朋友').trim();
  const floorToShow = isGameOver ? currentFloor : Math.max(currentFloor, bestFloor);
  const titleToShow = isGameOver ? lastTitle : computeTitle(floorToShow, lastCause);
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    c: name,
    f: String(floorToShow),
    t: String(Math.round(elapsedMs || floorToShow * 1100)),
    d: lastCause
  });
  if (recordedGhost && recordedGhost.length > 5) {
    // Include compact ghost trajectory (up to 120 frames) so friends can race your ghost on GitHub Pages!
    const compactGhost = recordedGhost.slice(0, 120).map(fr => `${fr[0]},${fr[1]},${fr[2]}`).join(';');
    params.set('g', compactGhost);
  }
  const shareUrl = `${baseUrl}?${params.toString()}`;
  return `🏃【小朋友下樓梯 NS-SHAFT 全服連線版】\n🏆 ${name} 衝到了 地下 ${formatFloor(floorToShow)} 層！\n🏅 獲得稱號：${titleToShow}\n💀 死因：${lastCause}\n👻 快點連結跟我的幽靈殘影PK：\n${shareUrl}`;
}

function shareToLine() {
  const text = buildShareMessage();
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(lineUrl, '_blank', 'noopener,noreferrer');
}

function copyShareText() {
  navigator.clipboard.writeText(buildShareMessage()).then(() => {
    showToast('✅ 已複製戰績文字！快貼到群組挑戰朋友！');
  });
}

// ============================================================================
// Core Gameplay Lifecycle
// ============================================================================
function startNewGame() {
  activeSeed = useFixedSeed ? FIXED_MAP_SEED : Math.floor(Math.random() * 99999999);
  platforms = [];
  nextPlatIdx = 0;
  for (let i = 0; i < 10; i++) {
    platforms.push(createPlatform(nextPlatIdx++));
  }

  const firstPlat = platforms[0];
  player.x = firstPlat.x + firstPlat.w / 2;
  player.y = firstPlat.y - player.h / 2;
  player.vx = 0;
  player.vy = 0;
  player.hp = MAX_HP;
  player.grounded = true;
  player.currentPlat = firstPlat;
  firstPlat.touched = true;
  player.invulnTimer = 0;

  cameraY = 0;
  scrollSpeed = 105;
  currentFloor = 1;
  elapsedMs = 0;
  isGameOver = false;
  hasUploadedCurrentRun = false;
  lastUploadedRank = null;
  redFlashAlpha = 0;
  screenShake = 0;

  recordedGhost = [[Math.round(player.x), Math.round(player.y), 0]];
  ghostTimer = 0;
  particles.length = 0;
  floatingTexts.length = 0;

  gameOverModal.classList.add('hidden');
  imgPreviewModal.classList.add('hidden');
  updateLifeHUD();
  hudFloor.textContent = formatFloor(currentFloor);
  hudBestFloor.textContent = `個人最高 ${formatFloor(bestFloor)} 層`;
}

function triggerGameOver(cause) {
  if (isGameOver) return;
  isGameOver = true;
  lastCause = cause;
  lastTitle = computeTitle(currentFloor, cause);
  sfx.gameOver();
  screenShake = 14;
  redFlashAlpha = 0.55;
  spawnParticles(player.x, player.y, '#f43f5e', 28);

  if (currentFloor > bestFloor) {
    bestFloor = currentFloor;
    localStorage.setItem('nss_best_floor', String(bestFloor));
    hudBestFloor.textContent = `個人最高 ${formatFloor(bestFloor)} 層`;
  }

  // Capture a snapshot of the death scene for the Share Card image
  draw();
  deathSnapshotCanvas = document.createElement('canvas');
  deathSnapshotCanvas.width = W;
  deathSnapshotCanvas.height = H;
  deathSnapshotCanvas.getContext('2d').drawImage(canvas, 0, 0);

  // Populate Game Over Modal (Wait for user to click Upload button!)
  syncInputsFromSidebar();
  document.getElementById('modalCauseBadge').textContent = `💀 ${cause}`;
  document.getElementById('modalFloor').textContent = formatFloor(currentFloor);
  document.getElementById('modalTitleBadge').textContent = `🏅 獲得稱號：${lastTitle}`;
  document.getElementById('modalFloorStat').textContent = `${formatFloor(currentFloor)} 層`;
  document.getElementById('modalTimeStat').textContent = `${(elapsedMs / 1000).toFixed(1)}s`;
  document.getElementById('modalRankStat').textContent = '未上傳';

  btnUploadScore.disabled = false;
  btnUploadScore.textContent = '🚀 點擊上傳分數＆殘影到排行榜';

  gameOverModal.classList.remove('hidden');
}

function healPlayer(amount) {
  if (player.hp < MAX_HP) {
    player.hp = Math.min(MAX_HP, player.hp + amount);
    updateLifeHUD();
    addFloatingText(player.x, player.y - 20, `+${amount} ❤️`, '#22c55e');
  }
}

function damagePlayer(amount, causeText) {
  if (player.invulnTimer > 0) return;
  player.hp = Math.max(0, player.hp - amount);
  player.invulnTimer = 0.45;
  redFlashAlpha = 0.45;
  screenShake = 10;
  updateLifeHUD();
  sfx.hurt();
  spawnParticles(player.x, player.y, '#f43f5e', 18);
  addFloatingText(player.x, player.y - 24, `-${amount} ❤️ 啊！`, '#f43f5e');

  if (player.hp <= 0) {
    triggerGameOver(causeText);
  }
}

// ============================================================================
// Controls Setup (Keyboard + Mobile Ergonomic Buttons + Canvas Touch)
// ============================================================================
function isTypingInInput() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

window.addEventListener('keydown', e => {
  if (isTypingInInput()) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    keys.left = true;
    btnLeft.classList.add('pressed');
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    keys.right = true;
    btnRight.classList.add('pressed');
  } else if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    startNewGame();
  }
});

window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    keys.left = false;
    btnLeft.classList.remove('pressed');
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    keys.right = false;
    btnRight.classList.remove('pressed');
  }
});

function bindHoldButton(btn, dirKey) {
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    keys[dirKey] = true;
    btn.classList.add('pressed');
  });
  const release = () => {
    keys[dirKey] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);
}

bindHoldButton(btnLeft, 'left');
bindHoldButton(btnRight, 'right');

// Direct Canvas Touch/Drag: Left half moves left, Right half moves right
function handleCanvasPointer(e) {
  if (isGameOver) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < rect.width / 2) {
    keys.left = true;
    keys.right = false;
    btnLeft.classList.add('pressed');
    btnRight.classList.remove('pressed');
  } else {
    keys.right = true;
    keys.left = false;
    btnRight.classList.add('pressed');
    btnLeft.classList.remove('pressed');
  }
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  handleCanvasPointer(e);
});

canvas.addEventListener('pointermove', e => {
  if (e.buttons > 0) handleCanvasPointer(e);
});

window.addEventListener('pointerup', () => {
  keys.left = false;
  keys.right = false;
  btnLeft.classList.remove('pressed');
  btnRight.classList.remove('pressed');
});

// Button Bindings
btnUploadScore.addEventListener('click', handleManualUpload);
document.getElementById('btnSaveImgModal').addEventListener('click', openImageCardPreview);
document.getElementById('btnSaveImgSidebar').addEventListener('click', openImageCardPreview);
document.getElementById('btnDownloadPng').addEventListener('click', downloadCardPng);
document.getElementById('btnNativeShareImg').addEventListener('click', nativeShareCardImage);
document.getElementById('btnCloseImgModal').addEventListener('click', () => imgPreviewModal.classList.add('hidden'));
document.getElementById('btnLineModal').addEventListener('click', shareToLine);
document.getElementById('btnLineSidebar').addEventListener('click', shareToLine);
document.getElementById('btnShareModal').addEventListener('click', copyShareText);
document.getElementById('btnRestart').addEventListener('click', startNewGame);
document.getElementById('btnRetryModal').addEventListener('click', startNewGame);

document.getElementById('btnMute').addEventListener('click', e => {
  sfx.muted = !sfx.muted;
  e.currentTarget.textContent = sfx.muted ? '🔇' : '🔊';
});

btnSeedMode.addEventListener('click', () => {
  useFixedSeed = !useFixedSeed;
  btnSeedMode.textContent = useFixedSeed ? '📅 同圖競技' : '🎲 隨機地圖';
  showToast(
    useFixedSeed
      ? '📅 已切換為【同圖競技模式】：與全服幽靈殘影挑戰同一張地圖！'
      : '🎲 已切換為【經典隨機模式】：每局地板位置完全隨機！'
  );
  startNewGame();
});

// ============================================================================
// Physics & Update Loop (1:1 Authentic NS-Shaft Mechanics)
// ============================================================================
let lastTime = performance.now();

function update(rawDt) {
  const dt = Math.min(0.033, rawDt);

  if (!isGameOver) {
    elapsedMs += dt * 1000;
    if (player.invulnTimer > 0) {
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    }

    // 1. Authentic NS-Shaft speed curve: steps up every 10 floors
    const speedLevel = Math.floor(currentFloor / 10);
    scrollSpeed = 105 + Math.min(12, speedLevel) * 14 + (currentFloor % 10) * 0.8;
    cameraY += scrollSpeed * dt;

    // Update Floor Counter (every 420px of scroll = 1 underground floor)
    const newFloor = 1 + Math.floor(cameraY / 420);
    if (newFloor > currentFloor) {
      currentFloor = newFloor;
      hudFloor.textContent = formatFloor(currentFloor);
      if (currentFloor > bestFloor) {
        bestFloor = currentFloor;
        hudBestFloor.textContent = `個人最高 ${formatFloor(bestFloor)} 層`;
      }
      if (currentFloor % 10 === 0) {
        sfx.levelUp();
        addFloatingText(W / 2, cameraY + 140, `🎉 突破地下 ${formatFloor(currentFloor)} 層！`, '#38bdf8');
      }
    }

    // Spawn new platforms below screen & prune old ones above
    while (platforms.length === 0 || platforms[platforms.length - 1].y < cameraY + H + 140) {
      platforms.push(createPlatform(nextPlatIdx++));
    }
    while (platforms.length > 0 && platforms[0].y < cameraY - 120) {
      platforms.shift();
    }

    // 2. Horizontal Movement
    const moveSpeed = 240;
    if (keys.left && !keys.right) {
      player.vx = -moveSpeed;
      player.facing = -1;
      player.walkCycle += dt * 14;
    } else if (keys.right && !keys.left) {
      player.vx = moveSpeed;
      player.facing = 1;
      player.walkCycle += dt * 14;
    } else {
      player.vx = 0;
      player.facing = 0;
    }

    let conveyorVx = 0;
    if (player.grounded && player.currentPlat) {
      if (player.currentPlat.type === 'conveyor_left') conveyorVx = -130;
      else if (player.currentPlat.type === 'conveyor_right') conveyorVx = 130;
    }

    player.x += (player.vx + conveyorVx) * dt;

    const halfW = player.w / 2;
    if (player.x - halfW < WALL_W) player.x = WALL_W + halfW;
    if (player.x + halfW > W - WALL_W) player.x = W - WALL_W - halfW;

    // 3. Vertical Movement & Platform Collisions
    const prevBottom = player.y + player.h / 2;

    for (const p of platforms) {
      if (p.springCompress > 0) {
        p.springCompress = Math.max(0, p.springCompress - dt * 5);
      }
      if (p.type === 'fake' && p.flipTimer > 0 && !p.flipped) {
        p.flipTimer -= dt;
        if (p.flipTimer <= 0) {
          p.flipped = true;
          sfx.flip();
          if (player.currentPlat === p) {
            player.grounded = false;
            player.currentPlat = null;
          }
        }
      }
    }

    if (player.grounded && player.currentPlat) {
      const p = player.currentPlat;
      if (
        p.flipped ||
        p.passThrough ||
        player.x + halfW * 0.75 < p.x ||
        player.x - halfW * 0.75 > p.x + p.w
      ) {
        player.grounded = false;
        player.currentPlat = null;
      } else {
        player.y = p.y - player.h / 2;
        player.vy = 0;
      }
    }

    if (!player.grounded) {
      const GRAVITY = 980;
      player.vy = Math.min(580, player.vy + GRAVITY * dt);
      player.y += player.vy * dt;

      const newBottom = player.y + player.h / 2;
      if (player.vy >= 0) {
        for (const p of platforms) {
          if (p.flipped || p.passThrough) continue;
          if (
            prevBottom <= p.y + 12 &&
            newBottom >= p.y &&
            player.x + halfW * 0.75 >= p.x &&
            player.x - halfW * 0.75 <= p.x + p.w
          ) {
            player.y = p.y - player.h / 2;

            if (p.type === 'trampoline') {
              player.vy = -235;
              player.grounded = false;
              player.currentPlat = null;
              p.springCompress = 1.0;
              sfx.spring();
              spawnParticles(player.x, p.y, '#22c55e', 8);
              if (!p.touched) {
                p.touched = true;
                healPlayer(1);
              }
            } else if (p.type === 'spike') {
              player.vy = 0;
              player.grounded = true;
              player.currentPlat = p;
              if (!p.touched) {
                p.touched = true;
                damagePlayer(5, '踩到尖刺地板失血過多');
              }
            } else if (p.type === 'fake') {
              player.vy = 40;
              player.grounded = false;
              player.currentPlat = null;
              if (!p.touched) {
                p.touched = true;
                p.flipTimer = 0.08;
                healPlayer(1);
                sfx.flip();
              }
            } else {
              player.vy = 0;
              player.grounded = true;
              player.currentPlat = p;
              if (!p.touched) {
                p.touched = true;
                healPlayer(1);
                sfx.step();
                spawnParticles(player.x, p.y, '#38bdf8', 6);
              }
            }
            break;
          }
        }
      }
    }

    // 4. Ceiling Spikes Collision
    const ceilingBottomY = cameraY + 28;
    if (player.y - player.h / 2 <= ceilingBottomY) {
      const hitCause = player.vy < -50 ? '被彈簧床送去撞天花板' : '被天花板尖刺夾扁';
      damagePlayer(5, hitCause);
      if (player.currentPlat) {
        player.currentPlat.passThrough = true;
      }
      for (const p of platforms) {
        if (p.y < cameraY + 85) {
          p.passThrough = true;
        }
      }
      player.grounded = false;
      player.currentPlat = null;
      player.y = ceilingBottomY + player.h / 2 + 10;
      player.vy = 160;
    }

    // 5. Bottom Abyss Fall
    if (player.y - player.h / 2 > cameraY + H + 24) {
      player.hp = 0;
      updateLifeHUD();
      triggerGameOver('墜入無底深淵');
    }

    // 6. Record Ghost Frame every 100ms
    ghostTimer += dt;
    if (ghostTimer >= 0.1 && recordedGhost.length < 1500) {
      ghostTimer = 0;
      recordedGhost.push([Math.round(player.x), Math.round(player.y), player.facing]);
    }
  }

  if (redFlashAlpha > 0) redFlashAlpha = Math.max(0, redFlashAlpha - dt * 1.8);
  if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 40);

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

// ============================================================================
// Rendering Pipeline
// ============================================================================
function drawKidSprite(x, y, facing, walkCycle, isGhost = false, ghostName = '') {
  ctx.save();
  ctx.translate(x, y);
  if (isGhost) {
    ctx.globalAlpha = 0.45;
  } else if (player.invulnTimer > 0 && Math.floor(performance.now() / 60) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  const legOffset = facing !== 0 ? Math.sin(walkCycle) * 4 : 0;

  ctx.fillStyle = isGhost ? '#38bdf8' : '#facc15';
  ctx.fillRect(-7, 7 + legOffset, 5, 9);
  ctx.fillRect(2, 7 - legOffset, 5, 9);

  ctx.fillStyle = isGhost ? '#0284c7' : '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-10, -5, 20, 14, 4);
  ctx.fill();

  ctx.fillStyle = isGhost ? '#bae6fd' : '#fde047';
  ctx.beginPath();
  ctx.arc(0, -10, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isGhost ? '#38bdf8' : '#f43f5e';
  ctx.fillRect(-8, -16, 16, 4);

  const eyeX = facing * 2.5;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(eyeX - 4, -11, 2.5, 3);
  ctx.fillRect(eyeX + 1.5, -11, 2.5, 3);

  ctx.restore();

  if (isGhost && ghostName) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`👻 ${ghostName}`, x, y - 24);
    ctx.restore();
  }
}

function draw() {
  ctx.save();
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);

  const shakeX = (Math.random() - 0.5) * screenShake;
  const shakeY = (Math.random() - 0.5) * screenShake;
  ctx.translate(shakeX, shakeY - cameraY);

  // 1. Scrolling Shaft Background Grid & Depth Markers
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  const startGridY = Math.floor(cameraY / 64) * 64;
  for (let y = startGridY; y < cameraY + H + 64; y += 64) {
    ctx.beginPath();
    ctx.moveTo(WALL_W, y);
    ctx.lineTo(W - WALL_W, y);
    ctx.stroke();
  }

  const firstMarkFloor = Math.max(1, Math.floor(cameraY / 420));
  for (let f = firstMarkFloor; f <= firstMarkFloor + 2; f++) {
    const fy = f * 420 + 180;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.font = '900 42px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`B${String(f).padStart(3, '0')}F`, W / 2, fy);
    ctx.restore();
  }

  // 2. Left & Right Brick Shaft Walls
  const brickStart = Math.floor(cameraY / 32) * 32;
  for (let y = brickStart; y < cameraY + H + 32; y += 32) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, WALL_W - 2, 30);
    ctx.fillRect(W - WALL_W + 2, y, WALL_W - 2, 30);
  }

  // 3. Platforms (5 Classic Types)
  const animOffset = (performance.now() * 0.04) % 16;
  for (const p of platforms) {
    if (p.y < cameraY - 40 || p.y > cameraY + H + 40) continue;
    ctx.save();

    if (p.type === 'normal') {
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 3);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      const segW = (p.w - 8) / 4;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(p.x + 3 + i * (segW + 1), p.y + 3, segW - 1, p.h - 6);
      }
    } else if (p.type === 'spike') {
      ctx.fillStyle = '#881337';
      ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      const spikeCount = 9;
      const sw = p.w / spikeCount;
      ctx.beginPath();
      for (let i = 0; i < spikeCount; i++) {
        const sx = p.x + i * sw;
        ctx.moveTo(sx, p.y + 6);
        ctx.lineTo(sx + sw / 2, p.y - 7);
        ctx.lineTo(sx + sw, p.y + 6);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'trampoline') {
      const compressY = p.springCompress * 6;
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x, p.y + compressY, p.w, 5);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(p.x + 4, p.y + p.h - 4, p.w - 8, 4);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 18, p.y + compressY + 5, 12, p.h - 9 - compressY);
      ctx.strokeRect(p.x + p.w - 30, p.y + compressY + 5, 12, p.h - 9 - compressY);
    } else if (p.type === 'conveyor_left' || p.type === 'conveyor_right') {
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.roundRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6, 5);
      ctx.fill();

      ctx.fillStyle = '#e9d5ff';
      ctx.font = '900 11px monospace';
      ctx.textAlign = 'center';
      const arrowStr = p.type === 'conveyor_left' ? '◀ ◀ ◀ ◀ ◀' : '▶ ▶ ▶ ▶ ▶';
      const shift = p.type === 'conveyor_left' ? -animOffset + 8 : animOffset - 8;
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x + 4, p.y, p.w - 8, p.h);
      ctx.clip();
      ctx.fillText(arrowStr, p.x + p.w / 2 + shift * 0.5, p.y + 12);
      ctx.restore();
    } else if (p.type === 'fake') {
      if (p.flipped) {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
        ctx.fillRect(p.x, p.y, 10, 26);
        ctx.fillRect(p.x + p.w - 10, p.y, 10, 26);
      } else {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(p.x, p.y, p.w / 2 - 1, p.h);
        ctx.fillRect(p.x + p.w / 2 + 1, p.y, p.w / 2 - 1, p.h);
      }
    }

    ctx.restore();
  }

  // 5. Ghost Replay
  if (useFixedSeed && topGhost && topGhost.frames.length > 0 && toggleGhostInput.checked) {
    const gIdx = Math.min(
      topGhost.frames.length - 1,
      Math.floor(elapsedMs / 100)
    );
    const gf = topGhost.frames[gIdx];
    if (gf) {
      drawKidSprite(gf[0], gf[1], gf[2] || 0, elapsedMs * 0.015, true, topGhost.name);
    }
  }

  // 6. Player Character
  drawKidSprite(player.x, player.y, player.facing, player.walkCycle, false);

  // 7. Particles & Floating Combat Text
  for (const pt of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life);
    ctx.font = '800 13px "Segoe UI", sans-serif';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();

  // 8. Fixed Top Ceiling Spikes
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillStyle = '#cbd5e1';
  const topSpikeCount = 24;
  const tsw = W / topSpikeCount;
  ctx.beginPath();
  for (let i = 0; i < topSpikeCount; i++) {
    const sx = i * tsw;
    ctx.moveTo(sx, 12);
    ctx.lineTo(sx + tsw / 2, 28);
    ctx.lineTo(sx + tsw, 12);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (redFlashAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(244, 63, 94, ${redFlashAlpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function gameLoop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  update(rawDt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Boot
importUrlChallengeIfPresent();
startNewGame();
fetchLeaderboard();
setInterval(() => fetchLeaderboard(selectedGhostId), 8000);
requestAnimationFrame(gameLoop);
