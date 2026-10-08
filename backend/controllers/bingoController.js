// เกมบิงโกลักษณะแบบออนไลน์ (หน้า /game/online/) - เก็บห้องไว้ในหน่วยความจำ (เกมสั้น ๆ ไม่ต้องลงฐานข้อมูล)
// พิธีกรสร้างห้อง -> กลุ่มเข้าห้องด้วยรหัส ได้การ์ดสุ่ม -> พิธีกรสุ่มลักษณะ -> กลุ่มกดชื่อที่คิดว่าตรง (= ยกมือถาม)
// -> พิธีกรกดผ่าน/ไม่ผ่าน (ผ่านถึงได้กา, กาได้รอบละ 1 ช่อง) -> ครบแถวกด "บิงโก" ระบบเช็คแถวให้
// ข้อจำกัด: เซิร์ฟเวอร์รีสตาร์ต (deploy ใหม่) ห้องที่เล่นค้างอยู่จะหาย
const crypto = require('crypto');
const QRCode = require('qrcode');

const rooms = new Map();
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 60;
const MAX_PLAYERS = 120;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const token = () => crypto.randomBytes(16).toString('hex');
const now = () => Date.now();

function cleanup() {
  const cutoff = now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) if (room.touchedAt < cutoff) rooms.delete(code);
}
setInterval(cleanup, 30 * 60 * 1000).unref();

function newCode() {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let k = 0; k < 5; k++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('สร้างรหัสห้องไม่สำเร็จ');
}

function cleanList(list, maxLen, maxItems) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((x) => String(x || '').trim().slice(0, maxLen))
    .filter((x) => x && !seen.has(x) && seen.add(x))
    .slice(0, maxItems);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) { res.status(404).json({ error: 'ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว' }); return null; }
  room.touchedAt = now();
  return room;
}

function requireHost(req, res) {
  const room = getRoom(req, res);
  if (!room) return null;
  if (req.get('x-host-token') !== room.hostToken) { res.status(403).json({ error: 'เฉพาะพิธีกรของห้องนี้' }); return null; }
  return room;
}

function requirePlayer(req, res) {
  const room = getRoom(req, res);
  if (!room) return {};
  const player = room.players.get(String(req.get('x-player-id') || ''));
  if (!player || req.get('x-player-token') !== player.token) { res.status(403).json({ error: 'ไม่พบกลุ่มนี้ในห้อง กรุณาเข้าห้องใหม่' }); return {}; }
  player.seenAt = now();
  return { room, player };
}

// แถวที่ครบ (แนวนอน แนวตั้ง ทแยง) ของการ์ด n x n
function completedLines(n, marked) {
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
  lines.push(Array.from({ length: n }, (_, k) => k * n + k));
  lines.push(Array.from({ length: n }, (_, k) => k * n + (n - 1 - k)));
  return lines.filter((line) => line.every((i) => marked.has(i)));
}

function playerSummary(room, p) {
  return {
    id: p.id,
    name: p.name,
    markedCount: p.marked.size,
    lines: completedLines(room.size, p.marked).length,
    bingoAt: p.bingoAt,
    online: now() - p.seenAt < 15000,
  };
}

// ---------- พิธีกร ----------
function createRoom(req, res) {
  cleanup();
  if (rooms.size >= MAX_ROOMS) return res.status(503).json({ error: 'ห้องเต็ม ลองใหม่ภายหลัง' });
  const size = [3, 4, 5].includes(Number(req.body.size)) ? Number(req.body.size) : 4;
  const traits = cleanList(req.body.traits, 80, 300);
  const names = cleanList(req.body.names, 40, 500);
  if (traits.length < 3) return res.status(400).json({ error: 'ต้องมีลักษณะอย่างน้อย 3 ข้อ' });
  if (names.length < size * size) return res.status(400).json({ error: `ต้องมีรายชื่ออย่างน้อย ${size * size} ชื่อ` });
  const code = newCode();
  const room = {
    code, size, traits, names,
    hostToken: token(),
    deck: shuffle(traits), drawn: [], round: 0,
    players: new Map(), requests: [], bingos: [],
    createdAt: now(), touchedAt: now(),
  };
  rooms.set(code, room);
  res.status(201).json({ code, hostToken: room.hostToken, size });
}

function hostState(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  res.json({
    code: room.code,
    size: room.size,
    round: room.round,
    current: room.drawn[room.drawn.length - 1] || null,
    drawn: room.drawn,
    remaining: room.deck.length,
    players: [...room.players.values()].map((p) => playerSummary(room, p)).sort((a, b) => a.name.localeCompare(b.name, 'th')),
    requests: room.requests.filter((r) => r.status === 'pending'),
    bingos: room.bingos,
  });
}

function drawTrait(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  if (!room.deck.length) room.deck = shuffle(room.traits);
  const trait = room.deck.pop();
  room.drawn.push(trait);
  room.round += 1;
  // คำขอที่ค้างจากรอบก่อนถือว่าหมดอายุ
  room.requests.forEach((r) => { if (r.status === 'pending') r.status = 'expired'; });
  res.json({ round: room.round, current: trait });
}

function decideRequest(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const request = room.requests.find((r) => r.id === req.params.requestId);
  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'คำขอนี้ตัดสินไปแล้วหรือหมดอายุ' });
  request.status = req.body.approve ? 'approved' : 'rejected';
  request.decidedAt = now();
  if (request.status === 'approved') {
    const player = room.players.get(request.playerId);
    if (player) player.marked.add(request.cell);
  }
  res.json({ ok: true });
}

function resetRoom(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  room.deck = shuffle(room.traits);
  room.drawn = [];
  room.round = 0;
  room.requests = [];
  room.bingos = [];
  room.players.forEach((p) => { p.marked = new Set(); p.bingoAt = null; });
  res.json({ ok: true });
}

async function roomQr(req, res) {
  const room = getRoom(req, res);
  if (!room) return;
  const origin = String(req.query.origin || 'https://peetiwnong.site').replace(/[^a-zA-Z0-9:/._-]/g, '');
  const svg = await QRCode.toString(`${origin}/game/online/?room=${room.code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').send(svg);
}

// ---------- กลุ่มผู้เล่น ----------
function joinRoom(req, res) {
  const room = getRoom(req, res);
  if (!room) return;
  const name = String(req.body.name || '').trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อกลุ่ม' });
  if ([...room.players.values()].some((p) => p.name === name)) return res.status(409).json({ error: 'ชื่อกลุ่มนี้ถูกใช้แล้วในห้องนี้' });
  if (room.players.size >= MAX_PLAYERS) return res.status(409).json({ error: 'ห้องนี้มีผู้เล่นเต็มแล้ว' });
  const player = {
    id: crypto.randomBytes(6).toString('hex'),
    token: token(),
    name,
    board: shuffle(room.names).slice(0, room.size * room.size),
    marked: new Set(),
    bingoAt: null,
    seenAt: now(),
  };
  room.players.set(player.id, player);
  res.status(201).json({ playerId: player.id, playerToken: player.token });
}

function playerState(req, res) {
  const { room, player } = requirePlayer(req, res);
  if (!room) return;
  const mine = room.requests.filter((r) => r.playerId === player.id);
  const thisRound = mine.find((r) => r.round === room.round && r.status !== 'expired');
  const last = mine.filter((r) => r.status === 'approved' || r.status === 'rejected').sort((a, b) => b.decidedAt - a.decidedAt)[0] || null;
  res.json({
    code: room.code,
    name: player.name,
    size: room.size,
    board: player.board,
    marked: [...player.marked],
    round: room.round,
    current: room.drawn[room.drawn.length - 1] || null,
    drawn: room.drawn,
    request: thisRound ? { cell: thisRound.cell, status: thisRound.status } : null,
    lastDecision: last ? { cell: last.cell, status: last.status, trait: last.trait, decidedAt: last.decidedAt } : null,
    lines: completedLines(room.size, player.marked).length,
    bingoAt: player.bingoAt,
    bingos: room.bingos,
  });
}

// "ยกมือถาม": ขอกาช่องนี้กับลักษณะรอบปัจจุบัน - รอบละ 1 คำขอ (ถ้าไม่ผ่าน ขอใหม่ในรอบเดียวกันได้)
function requestMark(req, res) {
  const { room, player } = requirePlayer(req, res);
  if (!room) return;
  if (!room.round) return res.status(400).json({ error: 'รอพิธีกรสุ่มลักษณะก่อน' });
  const cell = Number(req.body.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= room.size * room.size) return res.status(400).json({ error: 'ช่องไม่ถูกต้อง' });
  if (player.marked.has(cell)) return res.status(400).json({ error: 'ช่องนี้กาไปแล้ว' });
  const thisRound = room.requests.filter((r) => r.playerId === player.id && r.round === room.round);
  if (thisRound.some((r) => r.status === 'pending')) return res.status(409).json({ error: 'รอพิธีกรตัดสินคำขอเดิมก่อน' });
  if (thisRound.some((r) => r.status === 'approved')) return res.status(409).json({ error: 'รอบนี้กาไปแล้ว 1 ช่อง รอลักษณะถัดไป' });
  room.requests.push({
    id: crypto.randomBytes(5).toString('hex'),
    playerId: player.id, playerName: player.name,
    cell, cellName: player.board[cell],
    round: room.round, trait: room.drawn[room.drawn.length - 1],
    status: 'pending', createdAt: now(),
  });
  res.status(201).json({ ok: true });
}

function claimBingo(req, res) {
  const { room, player } = requirePlayer(req, res);
  if (!room) return;
  const lines = completedLines(room.size, player.marked);
  if (!lines.length) return res.status(400).json({ error: 'ยังไม่ครบแถว' });
  if (!player.bingoAt) {
    player.bingoAt = now();
    room.bingos.push({ playerId: player.id, name: player.name, at: player.bingoAt, round: room.round, lines: lines.length, order: room.bingos.length + 1 });
  }
  res.json({ ok: true, order: room.bingos.find((b) => b.playerId === player.id).order });
}

module.exports = { createRoom, hostState, drawTrait, decideRequest, resetRoom, roomQr, joinRoom, playerState, requestMark, claimBingo };
