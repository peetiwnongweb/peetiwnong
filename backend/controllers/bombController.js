// เกมบอมโค้ด (หน้า /game/bomb/) - ทุกกลุ่มได้คำถามเดียวกันในแต่ละรอบ ถอดรหัสแล้วใส่รหัสผ่าน iPad ก่อนระเบิดหมดเวลา
// เก็บห้องไว้ในหน่วยความจำ (เกมสั้น ๆ ไม่ต้องลงฐานข้อมูล) - เซิร์ฟเวอร์รีสตาร์ต (deploy ใหม่) ห้องที่เล่นค้างอยู่จะหาย
// คำถามเก็บอยู่ในเครื่องพิธีกร ส่งมาทีละข้อตอนเริ่มรอบ เฉลยไม่ถูกส่งไปเครื่องกลุ่มจนกว่ารอบจะจบ
// กติกา: ปลดได้ลำดับที่ 1 +10 ลดลงทีละ 2 (10/8/6/4) ลำดับต่อจากนั้น +2 · ใส่ผิดครบจำนวนครั้ง หรือหมดเวลา = ระเบิด ไม่ได้คะแนน
const crypto = require('crypto');
const QRCode = require('qrcode');

const rooms = new Map();
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 60;
const MAX_PLAYERS = 60;
const MAX_IMAGES = 80;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const WRONG_COOLDOWN_MS = 2000;
const POINTS = [10, 8, 6, 4];
const LATE_POINTS = 2;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const token = () => crypto.randomBytes(16).toString('hex');
const now = () => Date.now();
const normCode = (v) => String(v == null ? '' : v).normalize('NFC').replace(/\s+/g, '').toUpperCase();
const pointsFor = (order) => POINTS[order - 1] || LATE_POINTS;

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

// สถานะของกลุ่มในรอบ: solved / exploded (ใส่ผิดครบ) / timeout (หมดเวลา) / playing
function entryStatus(round, e) {
  if (e && e.solvedAt) return 'solved';
  if (e && round.maxAttempts && e.wrong >= round.maxAttempts) return 'exploded';
  if (round.status === 'ended') return 'timeout';
  return 'playing';
}

// จบรอบอัตโนมัติเมื่อหมดเวลา หรือทุกกลุ่มปลดได้/ระเบิดหมดแล้ว (เรียกทุกครั้งที่มีคนดึงสถานะ)
function settle(room) {
  const r = room.round;
  if (!r || r.status !== 'running') return;
  if (now() >= r.endsAt) { r.status = 'ended'; r.endedAt = r.endsAt; r.endReason = 'timeout'; return; }
  const players = [...room.players.values()];
  if (players.length && players.every((p) => entryStatus(r, r.entries.get(p.id)) !== 'playing')) {
    r.status = 'ended'; r.endedAt = now(); r.endReason = 'all-done';
  }
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) { res.status(404).json({ error: 'ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว' }); return null; }
  room.touchedAt = now();
  settle(room);
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

// คำถามที่ส่งให้ทุกคนเห็น - เฉลยแนบไปเฉพาะเมื่อรอบจบแล้ว
function publicRound(room) {
  const r = room.round;
  if (!r) return null;
  const ended = r.status === 'ended';
  return {
    no: r.no,
    title: r.title,
    text: r.text,
    imageId: r.imageId,
    codeLength: r.answer.length,
    numeric: /^[0-9]+$/.test(r.answer),
    maxAttempts: r.maxAttempts,
    timeLimit: r.timeLimit,
    status: r.status,
    remainingMs: ended ? 0 : Math.max(0, r.endsAt - now()),
    endReason: r.endReason || null,
    answer: ended ? r.answer : null,
    solvedCount: [...r.entries.values()].filter((e) => e.solvedAt).length,
  };
}

function totalOf(room, p) {
  return room.history.reduce((sum, h) => sum + (h.points.get(p.id) || 0), 0) + (room.round ? (room.round.entries.get(p.id) || {}).points || 0 : 0) + p.adjust;
}

function leaderboard(room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, total: totalOf(room, p), adjust: p.adjust, online: now() - p.seenAt < 15000 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'th'));
}

function entryView(round, e) {
  return {
    status: entryStatus(round, e),
    wrong: e ? e.wrong : 0,
    order: e && e.order ? e.order : null,
    points: e ? e.points || 0 : 0,
    solvedMs: e && e.solvedAt ? e.solvedAt - round.startedAt : null,
  };
}

// ---------- พิธีกร ----------
function createRoom(req, res) {
  cleanup();
  if (rooms.size >= MAX_ROOMS) return res.status(503).json({ error: 'ห้องเต็ม ลองใหม่ภายหลัง' });
  const code = newCode();
  const room = {
    code, hostToken: token(),
    players: new Map(), images: new Map(),
    round: null, roundNo: 0, history: [],
    createdAt: now(), touchedAt: now(),
  };
  rooms.set(code, room);
  res.status(201).json({ code, hostToken: room.hostToken });
}

function hostState(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const r = room.round;
  const lb = leaderboard(room);
  res.json({
    code: room.code,
    round: publicRound(room),
    answer: r ? r.answer : null,
    players: lb.map((p) => {
      const e = r ? r.entries.get(p.id) : null;
      return Object.assign(p, r ? entryView(r, e) : {}, { tries: r && r.status === 'ended' && e ? e.tries : [] });
    }),
    history: room.history.map((h) => ({ no: h.no, title: h.title, answer: h.answer, solved: h.solved })),
  });
}

// รูปประกอบคำถาม ส่งเป็นไฟล์รูปตรง ๆ (ไม่ผ่าน JSON เพราะ express.json จำกัด 100kb)
function uploadImage(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const type = String(req.get('content-type') || '').split(';')[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type) || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'ไฟล์รูปไม่ถูกต้อง' });
  if (room.images.size >= MAX_IMAGES) room.images.delete(room.images.keys().next().value);
  const id = crypto.randomBytes(8).toString('hex');
  room.images.set(id, { type, data: req.body });
  res.status(201).json({ imageId: id });
}

function getImage(req, res) {
  const room = getRoom(req, res);
  if (!room) return;
  const img = room.images.get(String(req.params.imageId));
  if (!img) return res.status(404).json({ error: 'ไม่พบรูป' });
  res.set('Cache-Control', 'private, max-age=3600').type(img.type).send(img.data);
}

// ปิดรอบเดิมเก็บลงประวัติ (คะแนนรอบที่แล้วยังนับรวม)
function archiveRound(room) {
  const r = room.round;
  if (!r) return;
  const points = new Map();
  r.entries.forEach((e, pid) => { if (e.points) points.set(pid, e.points); });
  room.history.push({ no: r.no, title: r.title, answer: r.answer, solved: [...r.entries.values()].filter((e) => e.solvedAt).length, points });
  room.round = null;
}

function startRound(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  if (room.round && room.round.status === 'running') return res.status(409).json({ error: 'ยังมีรอบที่กำลังเล่นอยู่ จบรอบก่อน' });
  const answer = normCode(req.body.answer);
  if (!answer || answer.length > 12) return res.status(400).json({ error: 'รหัสเฉลยต้องมี 1-12 ตัว' });
  const text = String(req.body.text || '').trim().slice(0, 3000);
  const imageId = req.body.imageId && room.images.has(String(req.body.imageId)) ? String(req.body.imageId) : null;
  if (!text && !imageId) return res.status(400).json({ error: 'คำถามว่าง' });
  const timeLimit = Math.min(1800, Math.max(15, Math.round(Number(req.body.timeLimit) || 180)));
  const maxAttempts = Math.min(20, Math.max(0, Math.round(Number(req.body.maxAttempts) || 0)));
  archiveRound(room);
  room.roundNo += 1;
  const t = now();
  room.round = {
    no: room.roundNo,
    title: String(req.body.title || '').trim().slice(0, 80),
    text, imageId, answer, timeLimit, maxAttempts,
    status: 'running', startedAt: t, endsAt: t + timeLimit * 1000,
    entries: new Map(), solvedOrder: 0,
  };
  res.status(201).json({ ok: true, no: room.roundNo });
}

function endRound(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const r = room.round;
  if (!r || r.status !== 'running') return res.status(409).json({ error: 'ไม่มีรอบที่กำลังเล่น' });
  r.status = 'ended'; r.endedAt = now(); r.endReason = 'host';
  res.json({ ok: true });
}

function addTime(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const r = room.round;
  if (!r || r.status !== 'running') return res.status(409).json({ error: 'ไม่มีรอบที่กำลังเล่น' });
  const sec = Math.min(600, Math.max(-600, Math.round(Number(req.body.seconds) || 30)));
  r.endsAt = Math.max(now() + 1000, r.endsAt + sec * 1000);
  res.json({ ok: true });
}

function adjustScore(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  const p = room.players.get(String(req.params.playerId));
  if (!p) return res.status(404).json({ error: 'ไม่พบกลุ่ม' });
  p.adjust += Math.min(100, Math.max(-100, Math.round(Number(req.body.delta) || 0)));
  res.json({ ok: true });
}

function removePlayer(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  room.players.delete(String(req.params.playerId));
  res.json({ ok: true });
}

function resetRoom(req, res) {
  const room = requireHost(req, res);
  if (!room) return;
  room.round = null;
  room.roundNo = 0;
  room.history = [];
  room.players.forEach((p) => { p.adjust = 0; });
  res.json({ ok: true });
}

async function roomQr(req, res) {
  const room = getRoom(req, res);
  if (!room) return;
  const origin = String(req.query.origin || 'https://peetiwnong.site').replace(/[^a-zA-Z0-9:/._-]/g, '');
  const svg = await QRCode.toString(`${origin}/game/bomb/?room=${room.code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').send(svg);
}

// ---------- กลุ่มผู้เล่น ----------
function joinRoom(req, res) {
  const room = getRoom(req, res);
  if (!room) return;
  const name = String(req.body.name || '').trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อกลุ่ม' });
  if ([...room.players.values()].some((p) => p.name === name)) return res.status(409).json({ error: 'ชื่อกลุ่มนี้ถูกใช้แล้วในห้องนี้' });
  if (room.players.size >= MAX_PLAYERS) return res.status(409).json({ error: 'ห้องนี้มีกลุ่มเต็มแล้ว' });
  const player = { id: crypto.randomBytes(6).toString('hex'), token: token(), name, adjust: 0, seenAt: now() };
  room.players.set(player.id, player);
  res.status(201).json({ playerId: player.id, playerToken: player.token });
}

function playerState(req, res) {
  const { room, player } = requirePlayer(req, res);
  if (!room) return;
  const r = room.round;
  const e = r ? r.entries.get(player.id) : null;
  const lb = leaderboard(room);
  res.json({
    code: room.code,
    name: player.name,
    round: publicRound(room),
    me: r ? Object.assign(entryView(r, e), {
      tries: e ? e.tries.map((t) => ({ code: t.code, ok: t.ok })) : [],
      cooldownMs: e && e.lastWrongAt ? Math.max(0, e.lastWrongAt + WRONG_COOLDOWN_MS - now()) : 0,
    }) : null,
    total: totalOf(room, player),
    rank: lb.findIndex((p) => p.id === player.id) + 1,
    leaderboard: lb.map((p) => ({ name: p.name, total: p.total, me: p.id === player.id })),
  });
}

function guess(req, res) {
  const { room, player } = requirePlayer(req, res);
  if (!room) return;
  const r = room.round;
  if (!r || r.status !== 'running') return res.status(409).json({ error: r ? 'รอบนี้จบแล้ว' : 'รอพิธีกรเริ่มรอบ' });
  const code = normCode(req.body.code);
  if (code.length !== r.answer.length) return res.status(400).json({ error: `รหัสต้องมี ${r.answer.length} ตัว` });
  let e = r.entries.get(player.id);
  if (!e) { e = { wrong: 0, tries: [], solvedAt: null, order: null, points: 0, lastWrongAt: 0 }; r.entries.set(player.id, e); }
  const st = entryStatus(r, e);
  if (st === 'solved') return res.status(409).json({ error: 'กลุ่มคุณปลดระเบิดไปแล้ว' });
  if (st === 'exploded') return res.status(409).json({ error: 'ระเบิดไปแล้ว ใส่รหัสครบจำนวนครั้ง' });
  if (now() - e.lastWrongAt < WRONG_COOLDOWN_MS) return res.status(429).json({ error: 'ใจเย็น ๆ รอสักครู่แล้วลองใหม่' });
  const ok = code === r.answer;
  e.tries.push({ code, ok, at: now() });
  if (ok) {
    e.solvedAt = now();
    r.solvedOrder += 1;
    e.order = r.solvedOrder;
    e.points = pointsFor(e.order);
  } else {
    e.wrong += 1;
    e.lastWrongAt = now();
  }
  settle(room);
  res.json({ ok, order: e.order, points: e.points, wrong: e.wrong, status: entryStatus(r, e) });
}

module.exports = { createRoom, hostState, uploadImage, getImage, startRound, endRound, addTime, adjustScore, removePlayer, resetRoom, roomQr, joinRoom, playerState, guess };
