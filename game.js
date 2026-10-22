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
const btnJumpBoard = document.getElementById('btnJumpBoard');
const nameHint = document.getElementById('nameHint');

// Legend icons are drawn with the real platform renderer
function drawLegendIcons() {
  document.querySelectorAll('canvas.plat-icon').forEach(cv => {
    const c = cv.getContext('2d');
    const scale = 2;
    cv.width = 116 * scale;
    cv.height = 34 * scale;
    c.scale(scale, scale);
    drawPlatform(c, { x: 6, y: 11, w: 104, h: 16, type: cv.dataset.type, springCompress: 0, flipped: false }, 0);
  });
}

// Bump on every release so players can tell whether their phone loaded the new build
const GAME_VERSION = 'v2026.10.22o';
const DEFAULT_NAME = '電腦課高手';
document.getElementById('gameVersion').textContent = GAME_VERSION;

// Sync saved player name between sidebar and modal.
// Saved to both localStorage and a cookie: some in-app browsers (LINE, Facebook) drop localStorage between visits.
function loadSavedName() {
  try {
    const stored = localStorage.getItem('nss_name');
    if (stored) return stored;
  } catch (e) {}
  const m = document.cookie.match(/(?:^|;\s*)nss_name=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}
function saveName(name) {
  name = (name || '').trim().slice(0, 16);
  if (!name) return;
  try { localStorage.setItem('nss_name', name); } catch (e) {}
  document.cookie = `nss_name=${encodeURIComponent(name)}; max-age=31536000; path=/; SameSite=Lax`;
}

const savedName = loadSavedName();
if (savedName) playerNameInput.value = savedName;
modalNameInput.value = playerNameInput.value;

function syncInputsFromSidebar() {
  modalNameInput.value = playerNameInput.value;
  saveName(playerNameInput.value);
}
function syncInputsFromModal() {
  playerNameInput.value = modalNameInput.value;
  saveName(modalNameInput.value);
  updateNameHint();
}
// Highlight the name field while it still holds the default name
function updateNameHint() {
  const isDefault = !modalNameInput.value.trim() || modalNameInput.value.trim() === DEFAULT_NAME;
  modalNameInput.classList.toggle('needs-name', isDefault);
  nameHint.classList.toggle('hidden', !isDefault);
}
btnJumpBoard.addEventListener('click', () => leaderboardList.scrollIntoView({ behavior: 'smooth', block: 'start' }));
playerNameInput.addEventListener('input', syncInputsFromSidebar);
modalNameInput.addEventListener('input', syncInputsFromModal);
playerNameInput.addEventListener('change', syncInputsFromSidebar);
modalNameInput.addEventListener('change', syncInputsFromModal);

// ============================================================================
// Title / Achievement System (稱號系統)
// ============================================================================
function computeTitle(floor, cause) {
  let rankTitle = '🌱 剛進電腦教室的菜鳥';
  if (floor >= 400) rankTitle = '👑 地心之王・下樓梯神話';
  else if (floor >= 300) rankTitle = '💎 鑽石級無底洞傳奇';
  else if (floor >= 200) rankTitle = '🔥 熔岩層的不死鳥';
  else if (floor >= 100) rankTitle = '⭐ 下100層的傳說真男人';
  else if (floor >= 60) rankTitle = '🌋 地下深淵統治者';
  else if (floor >= 30) rankTitle = '⚡ 電腦課風雲人物';
  else if (floor >= 15) rankTitle = '👟 下樓梯熟練工';
  else if (floor >= 5) rankTitle = '🎒 偷玩電腦的小學生';

  if (cause.includes('彈簧')) return `${rankTitle}・天花板刺蝟`;
  if (cause.includes('尖刺地板')) return `${rankTitle}・鐵布衫苦主`;
  if (cause.includes('深淵')) return `${rankTitle}・自由落體大師`;
  return rankTitle;
}

// Leaderboard badge for very deep runs
function floorBadge(floor) {
  if (floor >= 400) return '👑 ';
  if (floor >= 300) return '💎 ';
  if (floor >= 200) return '🔥 ';
  return '';
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
  // 掉進深淵的「啊～～～」：鋸齒波加顫音，經過「啊」的母音共振峰濾波，音高一路往下掉
  fallScream() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 1.5;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(140, now + dur);

    const vibrato = this.ctx.createOscillator();
    const vibratoDepth = this.ctx.createGain();
    vibrato.frequency.value = 7;
    vibratoDepth.gain.value = 18;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(osc.frequency);

    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.001, now);
    out.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
    out.gain.setValueAtTime(0.5, now + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.001, now + dur);
    out.connect(this.ctx.destination);

    [[800, 6, 1], [1200, 8, 0.6], [2500, 10, 0.25]].forEach(([freq, q, level]) => {
      const formant = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      formant.type = 'bandpass';
      formant.frequency.value = freq;
      formant.Q.value = q;
      g.gain.value = level;
      osc.connect(formant);
      formant.connect(g);
      g.connect(out);
    });

    osc.start(now);
    vibrato.start(now);
    osc.stop(now + dur + 0.05);
    vibrato.stop(now + dur + 0.05);
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
let lastUploadedId = null;
let hasUploadedCurrentRun = false;
let isWaitingStart = true; // Each run waits for the first left/right input, so nobody dies before they're ready
let redFlashAlpha = 0;
let screenShake = 0;

// Ghost Recording & Playback
let recordedGhost = [];
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

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2800);
}

function updateGhostLabel() {
  if (!useFixedSeed) {
    ghostStatusLabel.textContent = '🎲 隨機地圖沒有殘影，切回「📅 同圖」才能 PK';
  } else if (!topGhost) {
    ghostStatusLabel.textContent = '👻 還沒有可以 PK 的殘影';
  } else {
    ghostStatusLabel.textContent = `👻 PK 對手：${topGhost.name} (${formatFloor(topGhost.floor)})`;
  }
}

// ============================================================================
// Online Leaderboard (Firebase Realtime Database, or server.js API when FIREBASE_DB_URL is empty)
// 讀取或上傳失敗時會明確顯示錯誤，不再偷偷改用本機假資料，避免每台裝置看到的排行榜不一樣。
// ============================================================================
const LEADERBOARD_SIZE = 50;   // Same as the ghost cutoff, so every visible row can be raced
const GHOST_MAX_FRAMES = 18000; // 30 minutes at 10 frames/s
const GHOST_KEEP_TOP = LEADERBOARD_SIZE; // only runs that would rank on the leaderboard upload a ghost
const ghostCache = new Map(); // id -> frames, so ghosts are downloaded only once
let urlChallenge = null;      // Friend challenge from a LINE share link (kept in memory, never uploaded)
let leaderboardOnline = false;
let allRecords = [];          // Every online record (not just the visible top 20), used for the ghost cutoff

function firebaseBase() {
  return FIREBASE_DB_URL.replace(/\/+$/, '');
}

function recordHasGhost(r) {
  return (Array.isArray(r.ghost) && r.ghost.length > 5) || (r.ghostLen || 0) > 5;
}

function sortRecords(records) {
  return records.sort((a, b) => (b.floor || 0) - (a.floor || 0) || (b.timeMs || 0) - (a.timeMs || 0));
}

function qualifiesForGhost(payload) {
  const ahead = allRecords.filter(r => (r.floor || 0) > payload.floor ||
    ((r.floor || 0) === payload.floor && (r.timeMs || 0) >= payload.timeMs)).length;
  return ahead < GHOST_KEEP_TOP;
}

// Shared challenge link: ?r=<record id> (current), or the older ?c=Name&f=42&t=38500&g=... form
async function importUrlChallengeIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('r');
  if (recordId) {
    await importRecordChallenge(recordId);
    return;
  }
  try {
    const cName = params.get('c');
    const cFloor = Number(params.get('f'));
    if (!cName || !cFloor) return;
    const cTime = Number(params.get('t')) || cFloor * 1100;
    const cCause = params.get('d') || '極限挑戰';
    let cGhost = [];
    const gParam = params.get('g');
    if (gParam) {
      cGhost = gParam.split(';').map(pair => {
        const [x, y, dir] = pair.split(',').map(Number);
        return [x || 240, y || 230, dir || 0];
      });
    }
    urlChallenge = {
      id: 'friend-' + cName + '-' + cFloor,
      name: `🔥${cName}`,
      floor: cFloor,
      timeMs: cTime,
      title: computeTitle(cFloor, cCause),
      cause: cCause,
      isFriendChallenge: true,
      hasGhost: cGhost.length > 5
    };
    if (urlChallenge.hasGhost) {
      ghostCache.set(urlChallenge.id, cGhost);
      selectedGhostId = urlChallenge.id;
    }
    setTimeout(() => showToast(`🔥 收到來自【${cName} (地下 B${String(cFloor).padStart(3, '0')} 層)】的殘影挑戰！`), 400);
  } catch (e) {}
}

async function importRecordChallenge(id) {
  try {
    if (!FIREBASE_DB_URL) {
      selectedGhostId = id;
      return;
    }
    const res = await fetch(`${firebaseBase()}/records/${encodeURIComponent(id)}.json`);
    const rec = res.ok ? await res.json() : null;
    if (!rec || typeof rec !== 'object') return;
    if (Array.isArray(rec.ghost) && rec.ghost.length > 5) ghostCache.set(id, rec.ghost);
    urlChallenge = { ...rec, id, hasGhost: recordHasGhost(rec) };
    delete urlChallenge.ghost;
    if (urlChallenge.hasGhost) selectedGhostId = id;
    setTimeout(() => showToast(`🔥 ${rec.name} (${formatFloor(rec.floor)}) 向你下戰帖！準備好就開始`), 400);
  } catch (e) {}
}

async function fetchRecordsFromFirebase() {
  const res = await fetch(`${firebaseBase()}/records.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Firebase read error ${res.status}`);
  const raw = await res.json();
  const records = raw && typeof raw === 'object'
    ? Object.entries(raw).map(([key, val]) => ({ ...val, id: key }))
    : [];
  for (const r of records) {
    // Older records stored the ghost inline; cache it and drop it from the list data
    if (Array.isArray(r.ghost) && r.ghost.length > 5) ghostCache.set(r.id, r.ghost);
    r.hasGhost = recordHasGhost(r);
    delete r.ghost;
  }
  sortRecords(records);
  return {
    records,
    stats: {
      totalGames: records.length,
      maxFloorEver: records.reduce((m, r) => Math.max(m, r.floor || 1), 1),
      totalFloorsDescended: records.reduce((s, r) => s + (r.floor || 0), 0)
    }
  };
}

async function fetchRecordsFromServer(ghostId) {
  const url = ghostId ? `/api/leaderboard?ghostId=${encodeURIComponent(ghostId)}` : '/api/leaderboard';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Server read error ${res.status}`);
  const data = await res.json();
  if (data.topGhost && Array.isArray(data.topGhost.frames)) {
    ghostCache.set(data.topGhost.id, data.topGhost.frames);
  }
  return { records: data.records || [], stats: data.stats };
}

// Download a ghost only when it is actually going to be raced
async function loadGhostFrames(id) {
  if (ghostCache.has(id)) return ghostCache.get(id);
  if (!FIREBASE_DB_URL) return null; // server.js mode: frames come with the leaderboard response
  const res = await fetch(`${firebaseBase()}/ghosts/${encodeURIComponent(id)}.json`);
  if (!res.ok) return null;
  const frames = await res.json();
  if (!Array.isArray(frames)) return null;
  ghostCache.set(id, frames);
  return frames;
}

async function selectGhost(records) {
  const withGhost = records.filter(r => r.hasGhost);
  const target = withGhost.find(r => r.id === selectedGhostId) || withGhost[0];
  if (!target) return;
  if (topGhost && topGhost.id === target.id) return;
  const frames = await loadGhostFrames(target.id);
  if (!frames) return;
  topGhost = { id: target.id, name: target.name, floor: target.floor, frames };
  selectedGhostId = target.id;
  updateGhostLabel();
}

async function fetchLeaderboard(ghostId = selectedGhostId) {
  try {
    const data = FIREBASE_DB_URL ? await fetchRecordsFromFirebase() : await fetchRecordsFromServer(ghostId);
    allRecords = data.records;
    const records = urlChallenge && !data.records.some(r => r.id === urlChallenge.id)
      ? sortRecords([...data.records, urlChallenge])
      : data.records;
    leaderboardData = { records: records.slice(0, LEADERBOARD_SIZE), deaths: [], stats: data.stats };
    leaderboardOnline = true;
    selectedGhostId = ghostId;
    await selectGhost(records);
    updateGhostLabel();
  } catch (err) {
    console.warn('[Johnny_LOG] Leaderboard fetch failed:', err);
    leaderboardOnline = false;
  }
  renderLeaderboard();
}

async function uploadToFirebase(payload) {
  const { ghost: rawGhost, ...record } = payload;
  const ghost = qualifiesForGhost(payload) ? rawGhost : [];
  record.ghostLen = ghost.length;
  const postRes = await fetch(`${firebaseBase()}/records.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });
  if (!postRes.ok) throw new Error(`Firebase POST failed ${postRes.status}`);
  const id = (await postRes.json()).name;
  if (ghost.length > 5) {
    // Ghost is stored separately so the leaderboard list stays small
    const ghostRes = await fetch(`${firebaseBase()}/ghosts/${encodeURIComponent(id)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ghost)
    });
    if (ghostRes.ok) ghostCache.set(id, ghost);
  }
  return id;
}

async function uploadToServer(payload) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Server POST failed ${res.status}`);
  const result = await res.json();
  if (payload.ghost.length > 5) ghostCache.set(result.id, payload.ghost);
  return result.id;
}

async function handleManualUpload() {
  if (hasUploadedCurrentRun) return true;
  syncInputsFromModal();

  btnUploadScore.disabled = true;
  btnUploadScore.textContent = '⏳ 正在上傳成績與殘影...';

  const payload = {
    name: (modalNameInput.value.trim() || '無名小朋友').slice(0, 16),
    floor: currentFloor,
    timeMs: Math.round(elapsedMs),
    cause: lastCause,
    title: lastTitle,
    deathX: Math.round(player.x),
    deathY: Math.round(player.y),
    date: new Date().toISOString(),
    ghost: useFixedSeed ? recordedGhost : [],
    ...(useFixedSeed ? {} : { mode: 'random' })
  };

  try {
    const newId = FIREBASE_DB_URL ? await uploadToFirebase(payload) : await uploadToServer(payload);
    hasUploadedCurrentRun = true;
    lastUploadedId = newId;
    await fetchLeaderboard();
    const rank = leaderboardOnline ? leaderboardData.records.findIndex(r => r.id === newId) + 1 : 0;
    lastUploadedRank = rank || null;
    document.getElementById('modalRankStat').textContent = rank ? `#${rank}` : '已上榜';
    btnUploadScore.textContent = rank
      ? `✅ 已同步至全服排行榜！(第 #${rank} 名)`
      : '✅ 已同步至全服排行榜！';
    showToast(rank ? `🏆 成績已上傳！你目前排全服第 #${rank} 名！` : '🏆 成績已上傳！');
    return true;
  } catch (err) {
    console.warn('[Johnny_LOG] Upload failed:', err);
    btnUploadScore.disabled = false;
    btnUploadScore.textContent = '⚠️ 上傳失敗，點此重試';
    showToast('⚠️ 上傳失敗，請檢查網路後再試一次');
    return false;
  }
}

function renderLeaderboard() {
  document.getElementById('statGames').textContent = leaderboardData.stats?.totalGames ?? 0;
  document.getElementById('statMaxFloor').textContent = formatFloor(leaderboardData.stats?.maxFloorEver ?? 1);
  document.getElementById('statTotalFloors').textContent = leaderboardData.stats?.totalFloorsDescended ?? 0;

  leaderboardList.innerHTML = '';
  const list = leaderboardData.records || [];

  document.getElementById('liveBadge').classList.toggle('offline', !leaderboardOnline);
  document.getElementById('liveText').textContent = leaderboardOnline ? 'LIVE' : '離線';
  const top = list[0];
  btnJumpBoard.textContent = top ? `🏆 第 1 名 ${top.name} ${formatFloor(top.floor)} ↓` : '🏆 排行榜 ↓';

  if (!leaderboardOnline) {
    const warn = document.createElement('div');
    warn.className = 'loading-text lb-offline';
    warn.textContent = list.length
      ? '⚠️ 連不上排行榜，以下是上次載入的資料，稍後自動重試'
      : '⚠️ 連不上排行榜，稍後自動重試...';
    leaderboardList.appendChild(warn);
  }

  if (list.length === 0) {
    if (!leaderboardOnline) return;
    leaderboardList.innerHTML = '<div class="loading-text">暫無紀錄，快成為第一名！</div>';
    return;
  }

  list.forEach((item, idx) => {
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
          <span class="lb-name"></span>${item.mode === 'random' ? '<span class="lb-tag">🎲隨機</span>' : ''}
          <span class="lb-cause lb-title"></span>
          <span class="lb-cause lb-death"></span>
        </div>
      </div>
      <div class="lb-right">
        <span class="lb-score">${floorBadge(item.floor)}${formatFloor(item.floor)} 層</span>
        <span class="lb-meta">${(item.timeMs / 1000).toFixed(1)}s</span>
      </div>
      ${item.hasGhost ? `<button class="lb-pk">${isSelectedGhost ? 'PK中' : '👻PK'}</button>` : ''}
      ${adminUser && item !== urlChallenge ? '<button class="lb-del" title="刪除這筆紀錄">🗑️</button>' : ''}
    `;
    row.querySelector('.lb-name').textContent = item.name;
    // Title and cause on separate lines so a long title never hides how they died
    row.querySelector('.lb-title').textContent = item.title || '';
    row.querySelector('.lb-death').textContent = item.cause ? `💀 ${item.cause}` : '';

    if (item.hasGhost) {
      row.addEventListener('click', () => challengeGhost(item));
    }
    const delBtn = row.querySelector('.lb-del');
    if (delBtn) {
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        adminDeleteRecord(item);
      });
    }

    leaderboardList.appendChild(row);
  });

  if (list.length) {
    const note = document.createElement('div');
    note.className = 'lb-footnote';
    note.textContent = `只顯示前 ${LEADERBOARD_SIZE} 名・🎲隨機地圖的成績沒有殘影可 PK`;
    leaderboardList.appendChild(note);
  }
}

// Pick a ghost from the leaderboard and immediately start a fresh run against it
async function challengeGhost(item) {
  const frames = await loadGhostFrames(item.id);
  if (!frames) {
    showToast('⚠️ 殘影下載失敗，請稍後再試');
    return;
  }
  selectedGhostId = item.id;
  topGhost = { id: item.id, name: item.name, floor: item.floor, frames };
  toggleGhostInput.checked = true;
  if (!useFixedSeed) setSeedMode(true);
  startNewGame();
  renderLeaderboard();
  canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`👻 對手：${item.name} (${formatFloor(item.floor)})，準備好就開始！`);
}

// ============================================================================
// Generate Retro Arcade Share Image Card (PNG) + LINE Share
// ============================================================================
let latestCardBlob = null;

// Middle panel of the share card. Uses the real platform and kid renderers so it matches the game.
function drawCardShaft(c, x, y, w, h, floor) {
  const shaftW = w - 150;
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, 14);
  c.clip();

  const bg = c.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#0b1730');
  bg.addColorStop(1, '#020409');
  c.fillStyle = bg;
  c.fillRect(x, y, w, h);

  // Brick walls
  c.fillStyle = '#1e293b';
  for (let by = y; by < y + h; by += 26) {
    c.fillRect(x, by, 14, 24);
    c.fillRect(x + shaftW - 14, by, 14, 24);
  }

  // Platforms scrolling past, the lower ones fading into the dark
  const plats = [
    ['normal', 0, 0.1], ['conveyor_right', 1, 0.24], ['spike', 0, 0.52],
    ['trampoline', 1, 0.66], ['fake', 0.05, 0.82], ['normal', 0.9, 0.96]
  ];
  for (const [type, fx, fy] of plats) {
    c.save();
    c.globalAlpha = 1 - fy * 0.55;
    drawPlatform(c, { x: x + 20 + fx * (shaftW - 150), y: y + fy * h, w: 104, h: 16, type, springCompress: 0, flipped: false }, 0);
    c.restore();
  }

  // Speed lines behind the falling kid
  const kx = x + shaftW / 2;
  const ky = y + h * 0.42;
  c.strokeStyle = 'rgba(250, 204, 21, 0.45)';
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const lx = kx - 30 + i * 10;
    const len = 40 + ((i * 37) % 50);
    c.lineWidth = 2 + (i % 3);
    c.beginPath();
    c.moveTo(lx, ky - 40 - len);
    c.lineTo(lx, ky - 40);
    c.stroke();
  }

  c.save();
  c.translate(kx, ky);
  c.scale(3, 3);
  c.shadowColor = '#facc15';
  c.shadowBlur = 12;
  drawKidSprite(0, 0, 1, 0, false, '', c);
  c.restore();

  // Depth gauge
  const gx = x + shaftW + 40;
  const gTop = y + 34;
  const gBot = y + h - 34;
  const maxFloor = Math.max(100, Math.ceil(floor / 50) * 50);
  const floorY = f => gTop + (Math.min(f, maxFloor) / maxFloor) * (gBot - gTop);

  c.fillStyle = 'rgba(148, 163, 184, 0.15)';
  c.fillRect(gx - 4, gTop, 8, gBot - gTop);
  const fill = c.createLinearGradient(0, gTop, 0, gBot);
  fill.addColorStop(0, '#38bdf8');
  fill.addColorStop(1, '#f43f5e');
  c.fillStyle = fill;
  c.fillRect(gx - 4, gTop, 8, floorY(floor) - gTop);

  c.font = '700 12px "Segoe UI", sans-serif';
  c.textAlign = 'left';
  for (let f = 0; f <= maxFloor; f += maxFloor / 5) {
    c.fillStyle = 'rgba(148, 163, 184, 0.7)';
    c.fillRect(gx + 6, floorY(f) - 1, 8, 2);
    c.fillText(`B${String(f).padStart(3, '0')}`, gx + 18, floorY(f) + 4);
  }

  // Rival ghost marker on the gauge (left side)
  if (topGhost && topGhost.floor && Math.abs(floorY(topGhost.floor) - floorY(floor)) > 22) {
    const ry = floorY(topGhost.floor);
    c.fillStyle = 'rgba(56, 189, 248, 0.9)';
    c.textAlign = 'right';
    c.font = '700 12px "Segoe UI", "Noto Sans TC", sans-serif';
    c.fillText(`👻 ${topGhost.name.slice(0, 6)}`, gx - 10, ry + 4);
  }

  // "You are here" marker
  const py = floorY(floor);
  c.fillStyle = '#facc15';
  c.shadowColor = '#facc15';
  c.shadowBlur = 10;
  c.beginPath();
  c.arc(gx, py, 8, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;
  c.textAlign = 'right';
  c.font = '900 14px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText(`我在這 ▶`, gx - 12, py + 5);

  c.restore();

  c.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(x, y, w, h, 14);
  c.stroke();
}

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

  // 4. Depth illustration: the kid plunging down a shaft, next to a B000–B100 depth gauge
  drawCardShaft(c, 36, 318, card.width - 72, 385, floorToShow);

  // 5. Footer Challenge Call-to-Action
  c.fillStyle = '#22c55e';
  c.font = '900 18px "Segoe UI", "Noto Sans TC", sans-serif';
  c.fillText('🔥 是男人就下 100 層！你敢來跟我的幽靈殘影 PK 嗎？', card.width / 2, 738);

  return card;
}

function openImageCardPreview() {
  const cardCanvas = generateShareCardCanvas();
  generatedCardImg.src = cardCanvas.toDataURL('image/png');
  latestCardBlob = null;
  cardCanvas.toBlob(blob => {
    latestCardBlob = blob;
  }, 'image/png');
  const canShareFiles = !!navigator.canShare &&
    navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  document.getElementById('btnNativeShareImg').classList.toggle('hidden', !canShareFiles);
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
      await navigator.share({ files: [file], text: buildShareMessage() });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // User closed the share sheet
    }
  }
  downloadCardPng();
}

function buildShareMessage() {
  const name = (modalNameInput.value || playerNameInput.value || '無名小朋友').trim();
  const floorToShow = isGameOver ? currentFloor : Math.max(currentFloor, bestFloor);
  const baseUrl = window.location.origin + window.location.pathname;
  // Uploaded runs share a short ?r=<id> link; the friend's page loads the ghost from the leaderboard
  const shareUrl = lastUploadedId ? `${baseUrl}?r=${encodeURIComponent(lastUploadedId)}` : baseUrl;
  const invite = lastUploadedId ? '👻 來跟我的殘影 PK' : '👻 來挑戰看看';
  return `🏃 ${name} 在《小朋友下樓梯》衝到地下 ${formatFloor(floorToShow)} 層！\n${invite}：${shareUrl}`;
}

async function shareToLine() {
  // Upload first so the link carries this run's ghost
  if (isGameOver && !hasUploadedCurrentRun && !(await handleManualUpload())) return;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(buildShareMessage())}`;
  window.location.href = lineUrl; // window.open after an await gets blocked by mobile popup blockers
}

function copyShareText() {
  const text = buildShareMessage();
  navigator.clipboard.writeText(text).then(
    () => showToast(lastUploadedId ? '✅ 已複製挑戰連結！' : '✅ 已複製！先上傳成績，連結才會帶你的殘影'),
    () => window.prompt('複製下面的文字：', text)
  );
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
  isWaitingStart = true;
  hasUploadedCurrentRun = false;
  lastUploadedRank = null;
  lastUploadedId = null;
  keys.left = false;
  keys.right = false;
  redFlashAlpha = 0;
  screenShake = 0;

  recordedGhost = [[Math.round(player.x), Math.round(player.y), 0]];
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
  if (cause === '墜入無底深淵') sfx.fallScream();
  else sfx.gameOver();
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

  // Populate Game Over Modal (Wait for user to click Upload button!)
  syncInputsFromSidebar();
  document.getElementById('modalCauseBadge').textContent = `💀 ${cause}`;
  document.getElementById('modalFloor').textContent = formatFloor(currentFloor);
  document.getElementById('modalTitleBadge').textContent = `🏅 獲得稱號：${lastTitle}`;
  document.getElementById('modalFloorStat').textContent = `${formatFloor(currentFloor)} 層`;
  document.getElementById('modalTimeStat').textContent = `${(elapsedMs / 1000).toFixed(1)}s`;
  document.getElementById('modalRankStat').textContent = '未上傳';

  btnUploadScore.disabled = false;
  btnUploadScore.textContent = '🚀 上傳成績到排行榜';

  updateNameHint();
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

function beginRunIfWaiting() {
  if (!isWaitingStart || isGameOver) return;
  isWaitingStart = false;
  sfx.init(); // Audio can only start from a user gesture
}

// Restarting mid-run asks first (and pauses the game), so a stray tap never throws away a good run
const confirmRestartModal = document.getElementById('confirmRestartModal');
let isPaused = false;
let pendingRestart = null;
function requestRestart(onConfirm = startNewGame) {
  if (isWaitingStart || (isGameOver && hasUploadedCurrentRun)) {
    onConfirm();
    return;
  }
  // A finished run that isn't uploaded yet is just as easy to lose as one in progress
  const unsaved = isGameOver;
  document.getElementById('confirmRestartTitle').textContent = unsaved ? '⚠️ 成績還沒上傳' : '⚠️ 遊戲進行中';
  document.getElementById('confirmRestartText').textContent = unsaved ? '這場成績還沒上傳，要怎麼處理？' : '確定要放棄這局重來嗎？';
  document.getElementById('btnCancelRestart').textContent = unsaved ? '返回' : '繼續玩';
  document.getElementById('btnConfirmRestart').textContent = unsaved ? '放棄' : '重來';
  confirmRestartModal.classList.toggle('unsaved', unsaved);
  pendingRestart = onConfirm;
  isPaused = true;
  keys.left = keys.right = false;
  btnLeft.classList.remove('pressed');
  btnRight.classList.remove('pressed');
  confirmRestartModal.classList.remove('hidden');
}
function closeRestartConfirm(confirmed) {
  confirmRestartModal.classList.add('hidden');
  isPaused = false;
  lastTime = performance.now(); // Don't let the paused time leak into the next frame
  const action = pendingRestart;
  pendingRestart = null;
  if (confirmed && action) action();
}
document.getElementById('btnConfirmRestart').addEventListener('click', () => closeRestartConfirm(true));
document.getElementById('btnCancelRestart').addEventListener('click', () => closeRestartConfirm(false));
// Upload first, then restart; on a default name or a failed upload stay on the game-over screen
async function uploadThenRestart() {
  const action = pendingRestart;
  closeRestartConfirm(false);
  const name = modalNameInput.value.trim();
  if (!name || name === DEFAULT_NAME) {
    updateNameHint();
    modalNameInput.focus();
    showToast('✏️ 先輸入你的暱稱再上傳');
    return;
  }
  if (await handleManualUpload() && action) action();
}
document.getElementById('btnUploadRestart').addEventListener('click', uploadThenRestart);

window.addEventListener('keydown', e => {
  if (isTypingInInput()) return;
  if (isPaused) {
    // Enter confirms (or uploads, for an unsaved run), Esc / Space / R cancels, so mashing the restart key never discards a run
    if (e.key === 'Enter') {
      if (confirmRestartModal.classList.contains('unsaved')) uploadThenRestart();
      else closeRestartConfirm(true);
    }
    else if (e.key === 'Escape' || e.key === ' ' || e.key === 'r' || e.key === 'R') closeRestartConfirm(false);
    e.preventDefault();
    return;
  }
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) beginRunIfWaiting();
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    keys.left = true;
    btnLeft.classList.add('pressed');
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    keys.right = true;
    btnRight.classList.add('pressed');
  } else if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    if (!e.repeat) requestRestart();
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
    beginRunIfWaiting();
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
  beginRunIfWaiting();
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
document.getElementById('btnDownloadPng').addEventListener('click', downloadCardPng);
document.getElementById('btnNativeShareImg').addEventListener('click', nativeShareCardImage);
document.getElementById('btnCloseImgModal').addEventListener('click', () => imgPreviewModal.classList.add('hidden'));
document.getElementById('btnLineModal').addEventListener('click', shareToLine);
document.getElementById('btnShareModal').addEventListener('click', copyShareText);
document.getElementById('btnRestart').addEventListener('click', e => {
  e.currentTarget.blur(); // Keep Space from re-clicking the focused button
  requestRestart();
});
document.getElementById('btnRetryModal').addEventListener('click', () => requestRestart());

document.getElementById('btnMute').addEventListener('click', e => {
  sfx.muted = !sfx.muted;
  e.currentTarget.textContent = sfx.muted ? '🔇' : '🔊';
});

function setSeedMode(fixed) {
  useFixedSeed = fixed;
  btnSeedMode.textContent = useFixedSeed ? '📅 同圖' : '🎲 隨機';
  updateGhostLabel();
}

toggleGhostInput.addEventListener('change', updateGhostLabel);

btnSeedMode.addEventListener('click', () => requestRestart(() => {
  setSeedMode(!useFixedSeed);
  showToast(
    useFixedSeed
      ? '📅 已切換為【同圖競技模式】：與全服幽靈殘影挑戰同一張地圖！'
      : '🎲 已切換為【經典隨機模式】：每局地板位置完全隨機！'
  );
  startNewGame();
}));

// ============================================================================
// Physics & Update Loop (1:1 Authentic NS-Shaft Mechanics)
// ============================================================================
let lastTime = performance.now();

function update(rawDt) {
  const dt = Math.min(0.033, rawDt);

  if (!isGameOver && !isWaitingStart && !isPaused) {
    elapsedMs += dt * 1000;
    if (player.invulnTimer > 0) {
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    }

    // 1. Authentic NS-Shaft speed curve: steps up every 10 floors
    // database.rules.json checks floor vs. time against this curve; rerun tools/gen_floor_rule.py if it changes
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

    // 6. Record Ghost Frame every 100ms, keyed to elapsed time so frame i is exactly at i * 100ms
    //    (playback reads frames[floor(elapsedMs / 100)], so recording must never drift)
    while (recordedGhost.length <= elapsedMs / 100 && recordedGhost.length < GHOST_MAX_FRAMES) {
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
function drawKidSprite(x, y, facing, walkCycle, isGhost = false, ghostName = '', c = ctx) {
  c.save();
  c.translate(x, y);
  if (isGhost) {
    c.globalAlpha = 0.45;
  } else if (c === ctx && player.invulnTimer > 0 && Math.floor(performance.now() / 60) % 2 === 0) {
    c.globalAlpha = 0.4;
  }

  const legOffset = facing !== 0 ? Math.sin(walkCycle) * 4 : 0;

  c.fillStyle = isGhost ? '#38bdf8' : '#facc15';
  c.fillRect(-7, 7 + legOffset, 5, 9);
  c.fillRect(2, 7 - legOffset, 5, 9);

  c.fillStyle = isGhost ? '#0284c7' : '#38bdf8';
  c.beginPath();
  c.roundRect(-10, -5, 20, 14, 4);
  c.fill();

  c.fillStyle = isGhost ? '#bae6fd' : '#fde047';
  c.beginPath();
  c.arc(0, -10, 8, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = isGhost ? '#38bdf8' : '#f43f5e';
  c.fillRect(-8, -16, 16, 4);

  const eyeX = facing * 2.5;
  c.fillStyle = '#090d16';
  c.fillRect(eyeX - 4, -11, 2.5, 3);
  c.fillRect(eyeX + 1.5, -11, 2.5, 3);

  c.restore();

  if (isGhost && ghostName) {
    c.save();
    c.globalAlpha = 0.72;
    c.fillStyle = '#38bdf8';
    c.font = '700 11px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.fillText(`👻 ${ghostName}`, x, y - 24);
    c.restore();
  }
}

// Shared by the game canvas and the legend icons under it, so both always look the same
function drawPlatform(c, p, animOffset) {
  if (p.type === 'normal') {
    c.fillStyle = '#38bdf8';
    c.shadowColor = '#38bdf8';
    c.shadowBlur = 8;
    c.beginPath();
    c.roundRect(p.x, p.y, p.w, p.h, 3);
    c.fill();
    c.fillStyle = '#0f172a';
    const segW = (p.w - 8) / 4;
    for (let i = 0; i < 4; i++) {
      c.fillRect(p.x + 3 + i * (segW + 1), p.y + 3, segW - 1, p.h - 6);
    }
  } else if (p.type === 'spike') {
    c.fillStyle = '#881337';
    c.fillRect(p.x, p.y + 6, p.w, p.h - 6);
    c.fillStyle = '#f43f5e';
    c.shadowColor = '#f43f5e';
    c.shadowBlur = 10;
    const spikeCount = 9;
    const sw = p.w / spikeCount;
    c.beginPath();
    for (let i = 0; i < spikeCount; i++) {
      const sx = p.x + i * sw;
      c.moveTo(sx, p.y + 6);
      c.lineTo(sx + sw / 2, p.y - 7);
      c.lineTo(sx + sw, p.y + 6);
    }
    c.closePath();
    c.fill();
  } else if (p.type === 'trampoline') {
    const compressY = p.springCompress * 6;
    c.fillStyle = '#22c55e';
    c.shadowColor = '#22c55e';
    c.shadowBlur = 8;
    c.fillRect(p.x, p.y + compressY, p.w, 5);
    c.fillStyle = '#15803d';
    c.fillRect(p.x + 4, p.y + p.h - 4, p.w - 8, 4);
    c.strokeStyle = '#cbd5e1';
    c.lineWidth = 2;
    c.strokeRect(p.x + 18, p.y + compressY + 5, 12, p.h - 9 - compressY);
    c.strokeRect(p.x + p.w - 30, p.y + compressY + 5, 12, p.h - 9 - compressY);
  } else if (p.type === 'conveyor_left' || p.type === 'conveyor_right') {
    c.fillStyle = '#a855f7';
    c.shadowColor = '#a855f7';
    c.shadowBlur = 8;
    c.beginPath();
    c.roundRect(p.x, p.y, p.w, p.h, 8);
    c.fill();
    c.fillStyle = '#1e1b4b';
    c.beginPath();
    c.roundRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6, 5);
    c.fill();

    c.fillStyle = '#e9d5ff';
    c.font = '900 11px monospace';
    c.textAlign = 'center';
    const arrowStr = p.type === 'conveyor_left' ? '◀ ◀ ◀ ◀ ◀' : '▶ ▶ ▶ ▶ ▶';
    const shift = p.type === 'conveyor_left' ? -animOffset + 8 : animOffset - 8;
    c.save();
    c.beginPath();
    c.rect(p.x + 4, p.y, p.w - 8, p.h);
    c.clip();
    c.fillText(arrowStr, p.x + p.w / 2 + shift * 0.5, p.y + 12);
    c.restore();
  } else if (p.type === 'fake') {
    if (p.flipped) {
      c.fillStyle = 'rgba(251, 146, 60, 0.45)';
      c.fillRect(p.x, p.y, 10, 26);
      c.fillRect(p.x + p.w - 10, p.y, 10, 26);
    } else {
      c.fillStyle = '#fb923c';
      c.fillRect(p.x, p.y, p.w / 2 - 1, p.h);
      c.fillRect(p.x + p.w / 2 + 1, p.y, p.w / 2 - 1, p.h);
    }
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

    drawPlatform(ctx, p, animOffset);

    ctx.restore();
  }

  // 5. Ghost Replay
  if (useFixedSeed && topGhost && topGhost.frames.length > 0 && toggleGhostInput.checked) {
    // Once the recording ends the ghost disappears instead of freezing in place
    const gf = topGhost.frames[Math.floor(elapsedMs / 100)];
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

  if (isWaitingStart && !isGameOver) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 7, 15, 0.72)';
    ctx.fillRect(0, H * 0.62, W, 120);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.font = '900 28px "Segoe UI", "Noto Sans TC", sans-serif';
    ctx.fillText('按 ◀ ▶ 開始', W / 2, H * 0.62 + 50);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 16px "Segoe UI", "Noto Sans TC", sans-serif';
    const ghostOn = useFixedSeed && topGhost && toggleGhostInput.checked;
    ctx.fillText(ghostOn ? `👻 對手：${topGhost.name} (${formatFloor(topGhost.floor)})` : '或直接點畫面左右兩邊', W / 2, H * 0.62 + 86);
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

// ============================================================================
// Hidden admin mode: long-press the version label for 3 seconds, sign in with Google.
// The page only shows the delete buttons; database.rules.json is what actually allows
// deletes, and only for ADMIN_UID. The Firebase SDK is loaded only when needed.
// ============================================================================
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB-IfYv9NzuN6aiIKjLVBaLQANqJtcs5UQ',
  authDomain: 'ns-shaft-5e71f.firebaseapp.com',
  projectId: 'ns-shaft-5e71f',
  appId: '1:614763824077:web:6f030f0e842c7455d4fa84'
};
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const adminModal = document.getElementById('adminModal');
let adminUser = null;
let firebaseAuth = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

async function initAdminAuth() {
  if (firebaseAuth) return firebaseAuth;
  await loadScript(FIREBASE_SDK + 'firebase-app-compat.js');
  await loadScript(FIREBASE_SDK + 'firebase-auth-compat.js');
  firebase.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = firebase.auth();
  await new Promise(resolve => {
    const stop = firebaseAuth.onAuthStateChanged(user => {
      stop();
      resolve();
    });
  });
  firebaseAuth.onAuthStateChanged(user => {
    adminUser = user;
    try { user ? localStorage.setItem('nss_admin', '1') : localStorage.removeItem('nss_admin'); } catch (e) {}
    renderAdminPanel();
    renderLeaderboard();
  });
  return firebaseAuth;
}

function renderAdminPanel() {
  const signedIn = !!adminUser;
  document.getElementById('adminSignedOut').classList.toggle('hidden', signedIn);
  document.getElementById('adminSignedIn').classList.toggle('hidden', !signedIn);
  if (signedIn) {
    document.getElementById('adminEmail').textContent = adminUser.email || '';
    document.getElementById('adminUid').textContent = adminUser.uid;
  }
}

async function openAdminPanel() {
  adminModal.classList.remove('hidden');
  document.getElementById('adminStatus').textContent = '';
  try {
    await initAdminAuth();
    renderAdminPanel();
  } catch (e) {
    document.getElementById('adminStatus').textContent = '⚠️ 載入登入元件失敗，請檢查網路';
  }
}

async function adminRequest(path, method = 'DELETE') {
  const token = await adminUser.getIdToken();
  const res = await fetch(`${firebaseBase()}/${path}.json?auth=${encodeURIComponent(token)}`, { method });
  if (!res.ok) throw new Error(`${method} ${path} failed ${res.status}`);
  return res;
}

async function adminDeleteRecord(item) {
  if (!adminUser) return;
  if (!confirm(`確定刪除這筆紀錄？\n\n${item.name}　${formatFloor(item.floor)} 層　${(item.timeMs / 1000).toFixed(1)}s`)) return;
  try {
    // Ghost first: its write rule depends on the record, so the record goes last
    await adminRequest(`ghosts/${encodeURIComponent(item.id)}`);
    await adminRequest(`records/${encodeURIComponent(item.id)}`);
    ghostCache.delete(item.id);
    if (selectedGhostId === item.id) {
      selectedGhostId = null;
      topGhost = null;
    }
    showToast(`🗑️ 已刪除 ${item.name} 的紀錄`);
    fetchLeaderboard();
  } catch (e) {
    console.warn('[Johnny_LOG] Admin delete failed:', e);
    showToast('⚠️ 刪除失敗：可能規則還沒加入你的管理員 UID');
  }
}

async function adminCleanOrphanGhosts() {
  const status = document.getElementById('adminStatus');
  status.textContent = '清理中...';
  try {
    const [recRes, ghostRes] = await Promise.all([
      fetch(`${firebaseBase()}/records.json?shallow=true`, { cache: 'no-store' }),
      fetch(`${firebaseBase()}/ghosts.json?shallow=true`, { cache: 'no-store' })
    ]);
    const recIds = new Set(Object.keys((await recRes.json()) || {}));
    const orphans = Object.keys((await ghostRes.json()) || {}).filter(id => !recIds.has(id));
    for (const id of orphans) await adminRequest(`ghosts/${encodeURIComponent(id)}`);
    status.textContent = orphans.length ? `✅ 已清掉 ${orphans.length} 筆孤兒殘影` : '✅ 沒有孤兒殘影';
  } catch (e) {
    console.warn('[Johnny_LOG] Orphan cleanup failed:', e);
    status.textContent = '⚠️ 清理失敗：可能規則還沒加入你的管理員 UID';
  }
}

document.getElementById('btnAdminSignIn').addEventListener('click', async () => {
  try {
    await firebaseAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    document.getElementById('adminStatus').textContent =
      `⚠️ 登入失敗（${e.code || e.message}）。LINE 內建瀏覽器不能用 Google 登入，請改用 Safari 或 Chrome`;
  }
});
document.getElementById('btnAdminSignOut').addEventListener('click', () => firebaseAuth.signOut());
document.getElementById('btnAdminClean').addEventListener('click', adminCleanOrphanGhosts);
document.getElementById('btnAdminCopyUid').addEventListener('click', () => {
  const uid = adminUser ? adminUser.uid : '';
  navigator.clipboard?.writeText(uid).then(() => showToast('📋 UID 已複製'), () => prompt('複製這串 UID：', uid));
});
document.getElementById('btnAdminClose').addEventListener('click', () => adminModal.classList.add('hidden'));

// Long-press (3 s) on the version label opens the admin panel
(() => {
  const label = document.getElementById('gameVersion');
  let timer = null;
  const cancel = () => clearTimeout(timer);
  label.addEventListener('pointerdown', () => {
    cancel();
    timer = setTimeout(openAdminPanel, 3000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => label.addEventListener(ev, cancel));
  label.addEventListener('contextmenu', e => e.preventDefault());
})();

// Stay in admin mode across visits once signed in
try {
  if (localStorage.getItem('nss_admin')) initAdminAuth().catch(() => {});
} catch (e) {}

// Boot
startNewGame();
importUrlChallengeIfPresent().finally(() => fetchLeaderboard());
setInterval(() => fetchLeaderboard(selectedGhostId), 8000);
requestAnimationFrame(gameLoop);

drawLegendIcons();
