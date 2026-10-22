const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3081;
const DATA_FILE = path.join(__dirname, 'shaft_leaderboard.json');
const STATIC_DIR = __dirname;
// Only these files are served, so server.js and the leaderboard data can't be downloaded
const STATIC_FILES = new Set(['/index.html', '/game.js', '/style.css']);

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePlatformAtIndex(idx, seed = 20261022) {
  const rng = mulberry32(seed + idx * 9973);
  const y = 260 + idx * 92;
  const w = 104;
  if (idx === 0) {
    return { idx, x: 240 - w / 2, y, w, type: 'normal' };
  }
  const x = Math.floor(24 + rng() * (480 - 48 - w));
  const r = rng();
  let type = 'normal';
  const spikeChance = Math.min(0.24, 0.13 + idx * 0.0003);
  if (r < spikeChance) type = 'spike';
  else if (r < spikeChance + 0.10) type = 'trampoline';
  else if (r < spikeChance + 0.20) type = 'conveyor_left';
  else if (r < spikeChance + 0.30) type = 'conveyor_right';
  else if (r < spikeChance + 0.40) type = 'fake';
  return { idx, x, y, w, type };
}

function createDefaultData() {
  const ghostFrames = [];
  let gx = 240;
  let gy = 230;
  let camY = 0;

  for (let tick = 0; tick < 520; tick++) {
    const scrollSpeed = 105 + tick * 0.12;
    camY += scrollSpeed * 0.1;
    const approxIdx = Math.max(0, Math.round((gy - 220) / 92));
    let targetPlat = generatePlatformAtIndex(approxIdx);
    if (targetPlat.type === 'spike' && approxIdx > 0) {
      targetPlat = generatePlatformAtIndex(approxIdx + 1);
    }
    const targetX = targetPlat.x + targetPlat.w / 2;
    gx += (targetX - gx) * 0.38;
    gy = Math.max(camY + 90, Math.min(camY + 460, targetPlat.y - 16));
    const dir = targetX > gx + 3 ? 1 : targetX < gx - 3 ? -1 : 0;
    ghostFrames.push([Math.round(gx), Math.round(gy), dir]);
  }

  const p12 = generatePlatformAtIndex(12);
  const p27 = generatePlatformAtIndex(27);
  const p41 = generatePlatformAtIndex(41);
  const p58 = generatePlatformAtIndex(58);

  return {
    records: [
      {
        id: 'seed-1',
        name: '⚡電腦課之神',
        floor: 64,
        timeMs: 68400,
        title: '🌋 地下深淵統治者',
        cause: '被彈簧床送去撞天花板',
        msg: 'B60以後速度快到眼花！',
        date: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        ghost: ghostFrames
      },
      {
        id: 'seed-2',
        name: '七年級老司機',
        floor: 48,
        timeMs: 51200,
        title: '⚡ 電腦課風雲人物',
        cause: '踩到尖刺地板失血過多',
        msg: '以前能破百層，現在手殘了',
        date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        ghost: []
      },
      {
        id: 'seed-3',
        name: '阿凱不想上班',
        floor: 31,
        timeMs: 34900,
        title: '⚡ 電腦課風雲人物',
        cause: '墜入無底深淵',
        msg: '輸送帶一直把我往右推QAQ',
        date: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
        ghost: []
      },
      {
        id: 'seed-4',
        name: '小明',
        floor: 18,
        timeMs: 21500,
        title: '👟 下樓梯熟練工',
        cause: '被天花板尖刺夾扁',
        msg: '假地板害我空踩！',
        date: new Date(Date.now() - 1800 * 1000).toISOString(),
        ghost: []
      }
    ],
    deaths: [
      {
        x: Math.round(p12.x + p12.w / 2),
        y: p12.y - 10,
        floor: 12,
        name: '小明',
        cause: '踩到尖刺',
        msg: '這層尖刺千萬別踩！'
      },
      {
        x: Math.round(p27.x + p27.w / 2),
        y: p27.y - 10,
        floor: 27,
        name: '阿凱不想上班',
        cause: '摔落深淵',
        msg: '輸送帶直接送我下去'
      },
      {
        x: Math.round(p41.x + p41.w / 2),
        y: p41.y - 10,
        floor: 41,
        name: '七年級老司機',
        cause: '撞上頂部尖刺',
        msg: '彈簧床是陷阱啊啊啊'
      },
      {
        x: Math.round(p58.x + p58.w / 2),
        y: p58.y - 10,
        floor: 58,
        name: '⚡電腦課之神',
        cause: '失血過多',
        msg: '差一點就破 B65 了！'
      }
    ],
    stats: {
      totalGames: 218,
      maxFloorEver: 64,
      totalFloorsDescended: 4890
    }
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Johnny_LOG] Error loading shaft leaderboard:', err);
  }
  const initial = createDefaultData();
  saveData(initial);
  return initial;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Johnny_LOG] Error saving shaft leaderboard:', err);
  }
}

let db = loadData();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const ghostId = url.searchParams.get('ghostId');
    let targetGhostRec = null;
    if (ghostId) {
      targetGhostRec = db.records.find(r => r.id === ghostId && Array.isArray(r.ghost) && r.ghost.length > 5);
    }
    if (!targetGhostRec) {
      targetGhostRec = db.records.find(r => Array.isArray(r.ghost) && r.ghost.length > 5);
    }

    return sendJson(res, 200, {
      records: db.records.slice(0, 50).map(({ ghost, ...rest }) => ({
        ...rest,
        hasGhost: Array.isArray(ghost) && ghost.length > 5
      })),
      deaths: db.deaths.slice(-40),
      stats: db.stats,
      topGhost: targetGhostRec
        ? { id: targetGhostRec.id, name: targetGhostRec.name, floor: targetGhostRec.floor, frames: targetGhostRec.ghost }
        : null
    });
  }

  if (url.pathname === '/api/submit' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const name = String(body.name || '無名小朋友').trim().slice(0, 16) || '無名小朋友';
      const floor = Math.max(1, Math.min(9999, Math.round(Number(body.floor) || 1)));
      const timeMs = Math.max(500, Math.round(Number(body.timeMs) || 1000));
      const cause = String(body.cause || '墜入深淵').trim().slice(0, 24);
      const title = String(body.title || '👟 下樓梯挑戰者').trim().slice(0, 24);
      const msg = String(body.msg || '啊～～～！').trim().slice(0, 26);
      const deathX = Math.round(Number(body.deathX) || 240);
      const deathY = Math.round(Number(body.deathY) || 500);
      const ghost = Array.isArray(body.ghost) ? body.ghost.slice(0, 18000) : [];

      db.stats.totalGames = (db.stats.totalGames || 0) + 1;
      db.stats.totalFloorsDescended = (db.stats.totalFloorsDescended || 0) + floor;
      if (floor > (db.stats.maxFloorEver || 0)) {
        db.stats.maxFloorEver = floor;
      }

      const entry = {
        id: 'shaft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name,
        floor,
        timeMs,
        title,
        cause,
        msg,
        date: new Date().toISOString(),
        ...(body.mode === 'random' ? { mode: 'random' } : {}),
        ghost
      };

      db.records.push(entry);
      db.records.sort((a, b) => {
        if (b.floor !== a.floor) return b.floor - a.floor;
        return b.timeMs - a.timeMs;
      });

      const rank = db.records.findIndex(r => r.id === entry.id) + 1;

      // Keep top 100 records, retain ghost frames for the top 50 (same cutoff as the Firebase client)
      db.records = db.records.slice(0, 100).map((r, i) => ({
        ...r,
        ghost: i < 50 ? r.ghost : []
      }));

      db.deaths.push({
        x: deathX,
        y: deathY,
        floor,
        name,
        cause,
        msg,
        time: Date.now()
      });
      if (db.deaths.length > 50) {
        db.deaths = db.deaths.slice(-50);
      }

      saveData(db);
      console.log(`[Johnny_LOG] NS-Shaft manual score uploaded by ${name}: B${floor}F, rank=#${rank}`);
      return sendJson(res, 200, { ok: true, rank, id: entry.id });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!STATIC_FILES.has(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const fullPath = path.join(STATIC_DIR, filePath);

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }
  console.log(`[Johnny_LOG] NS-Shaft server running at http://localhost:${PORT} (LAN: http://${lanIp}:${PORT})`);
});
