const { getPrisma } = require('../lib/prisma');

// ==========================================
// เก็บสถิติการใช้งานเว็บ (ดู model Usage* ใน prisma/schema.prisma)
// นับทุกอย่างใน memory ก่อน แล้วค่อยเขียนลง DB ทีเดียวทุก FLUSH_INTERVAL_MS ด้วย INSERT ... ON CONFLICT (upsert รวมยอด)
// เหตุผล: ฐานข้อมูลอยู่บน Supabase pooler แผนฟรี ถ้าเขียนทุก request (หลายพันครั้ง/วัน) จะกินโควตา/connection โดยไม่จำเป็น
// ยอมรับได้ที่ข้อมูล ≤ 1 นาทีสุดท้ายหายถ้าเซิร์ฟเวอร์ดับกะทันหัน (เป็นสถิติ ไม่ใช่ข้อมูลธุรกรรม)
// ไม่เก็บ IP / body / query string / URL ที่มี id จริง - route เก็บเป็นแม่แบบของ express (เช่น /api/users/:id) เท่านั้น
// ==========================================

const FLUSH_INTERVAL_MS = 60 * 1000;
const TIMEZONE = 'Asia/Bangkok';

// ยอดสะสมที่ยังไม่ได้เขียนลง DB
const hourlyBuffer = new Map(); // key = bucketStart ISO (UTC ต้นชั่วโมง)
const endpointBuffer = new Map(); // key = `${day}|${method}|${route}`
const activeUserBuffer = new Map(); // key = `${day}|${userId}` -> role (เขียนครั้งเดียวต่อคนต่อวัน)
const activeUserWritten = new Set(); // key เดียวกับข้างบน ที่เขียนลง DB สำเร็จแล้ว (กัน INSERT ซ้ำทุกรอบ flush)
const hourlyActiveUsers = new Map(); // key = bucketStart ISO -> Set(userId) ไว้นับผู้ใช้ไม่ซ้ำต่อชั่วโมง

let flushTimer = null;
let flushing = false;
let tablesMissingWarned = false;

// วันที่แบบ YYYY-MM-DD ตามเวลาไทย (เซิร์ฟเวอร์โปรดักชันอาจตั้ง UTC ถ้าใช้ toISOString ตรง ๆ วันจะเคลื่อนตอน 07:00 เช้า)
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
function toBangkokDay(date) {
  return dayFormatter.format(date);
}

function toHourBucketIso(date) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

// จัดหมวดจาก User-Agent แบบหยาบ ๆ พอให้เห็นสัดส่วน (ไม่ต้องแม่นระดับไลบรารี)
// เช็ค LINE ก่อน เพราะ in-app browser ของ LINE บอกตัวเองว่าเป็น Safari/Chrome ด้วย - อันนี้สำคัญเพราะกล้อง/ดาวน์โหลดใน LINE มีข้อจำกัดต่างจากเบราว์เซอร์ปกติ
function classifyUserAgent(ua) {
  const text = String(ua || '');
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(text);
  let browser = 'other';
  if (/Line\//i.test(text)) browser = 'line';
  else if (/Chrome|CriOS|Chromium|Edg\//i.test(text)) browser = 'chrome';
  else if (/Safari/i.test(text)) browser = 'safari';
  return { isMobile, browser };
}

function roleKey(role) {
  if (role === 'PARTICIPANT') return 'participant';
  if (role === 'STAFF') return 'staff';
  if (role === 'WEBMANAGER') return 'webmanager';
  return 'guest';
}

function emptyHourly() {
  return {
    apiRequests: 0, pageViews: 0, errorCount: 0, clientErrorCount: 0, totalDurationMs: 0, maxDurationMs: 0,
    guest: 0, participant: 0, staff: 0, webmanager: 0, mobile: 0, desktop: 0,
    chrome: 0, safari: 0, line: 0, other: 0,
  };
}

// "หน้าเว็บ" = GET ที่ตอบ HTML (path ลงท้าย / หรือ .html) ไฟล์ static อื่น (css/js/รูป/ฟอนต์) ไม่นับเลย ไม่งั้นตัวเลขจะบวมเพราะหน้าเดียวโหลดของนับสิบไฟล์
function isPageView(req, fullPath, statusCode) {
  if (req.method !== 'GET') return false;
  if (statusCode !== 200 && statusCode !== 304) return false;
  return fullPath.endsWith('/') || fullPath.endsWith('.html');
}

// fullPath = path เต็มจาก originalUrl (ไม่รวม query) - ห้ามใช้ req.path ตรงนี้ เพราะตอน event finish ยิง คำขอยังอยู่ใน router ย่อย
// ซึ่ง express ตัด mount path ออกจาก req.path ไปแล้ว (เช่น /api/auth/login เหลือแค่ /login) ทำให้ดูไม่ออกว่าเป็น API
function record(req, res, fullPath, durationMs) {
  const now = new Date();
  const status = res.statusCode;
  const isApi = fullPath.startsWith('/api/');
  const pageView = !isApi && isPageView(req, fullPath, status);
  if (!isApi && !pageView) return;

  const user = req.session && req.session.user;
  const role = roleKey(user && user.role);
  const { isMobile, browser } = classifyUserAgent(req.headers['user-agent']);
  const hourKey = toHourBucketIso(now);
  const day = toBangkokDay(now);

  let hourly = hourlyBuffer.get(hourKey);
  if (!hourly) {
    hourly = emptyHourly();
    hourlyBuffer.set(hourKey, hourly);
  }
  hourly[role] += 1;
  hourly[isMobile ? 'mobile' : 'desktop'] += 1;
  hourly[browser] += 1;

  if (pageView) {
    hourly.pageViews += 1;
  } else {
    hourly.apiRequests += 1;
    hourly.totalDurationMs += durationMs;
    if (durationMs > hourly.maxDurationMs) hourly.maxDurationMs = Math.round(durationMs);
    if (status >= 500) hourly.errorCount += 1;
    else if (status >= 400) hourly.clientErrorCount += 1;

    // route แม่แบบจาก express (มีเฉพาะตอน match route จริง เช่น /api/users/:id) ถ้าไม่มี (404 ใน /api หรือ error ที่หลุดไปถึง error handler ระดับ app ซึ่ง express ล้าง req.route/baseUrl ไปแล้ว)
    // ใช้ path จริงแต่แทนตัวเลขทุก segment ด้วย :id ให้กลายเป็นแม่แบบเหมือนกัน ไม่เก็บ id จริง และตัดความยาวกัน path แปลก ๆ ยาวผิดปกติ
    const routePath = req.route && typeof req.route.path === 'string' ? req.route.path : null;
    const route = routePath
      ? (`${req.baseUrl || ''}${routePath === '/' ? '' : routePath}` || '/')
      : fullPath.replace(/\/\d+(?=\/|$)/g, '/:id').slice(0, 120);
    const endpointKey = `${day}|${req.method}|${route}`;
    let endpoint = endpointBuffer.get(endpointKey);
    if (!endpoint) {
      endpoint = { day, method: req.method, route, requestCount: 0, totalDurationMs: 0, maxDurationMs: 0, errorCount: 0, clientErrorCount: 0 };
      endpointBuffer.set(endpointKey, endpoint);
    }
    endpoint.requestCount += 1;
    endpoint.totalDurationMs += durationMs;
    if (durationMs > endpoint.maxDurationMs) endpoint.maxDurationMs = Math.round(durationMs);
    if (status >= 500) endpoint.errorCount += 1;
    else if (status >= 400) endpoint.clientErrorCount += 1;
  }

  if (user && Number.isInteger(user.id)) {
    const userKey = `${day}|${user.id}`;
    if (!activeUserWritten.has(userKey) && !activeUserBuffer.has(userKey)) {
      activeUserBuffer.set(userKey, { day, userId: user.id, role: String(user.role || '') });
    }
    let hourUsers = hourlyActiveUsers.get(hourKey);
    if (!hourUsers) {
      hourUsers = new Set();
      hourlyActiveUsers.set(hourKey, hourUsers);
    }
    hourUsers.add(user.id);
  }
}

function usageTracker(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const fullPath = String(req.originalUrl || req.url || '').split('?')[0];
  res.on('finish', () => {
    try {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      record(req, res, fullPath, durationMs);
    } catch (error) {
      // สถิติต้องไม่ทำให้คำขอจริงพังเด็ดขาด
      console.error('usageTracker บันทึกสถิติไม่สำเร็จ:', error);
    }
  });
  next();
}

// ==========================================
// เขียนลง DB
// ใช้ INSERT ... ON CONFLICT DO UPDATE แบบ raw SQL (หลายแถวในคำสั่งเดียว) แทน upsert ของ Prisma ที่ยิง 2 query ต่อแถว
// ตัวเลขทั้งหมดเป็น "ยอดเพิ่ม" ที่ต้องบวกทับของเดิม (ไม่ใช่แทนที่) ยกเว้น max_duration_ms ใช้ GREATEST
// active_users ต่อชั่วโมง: นับผู้ใช้ไม่ซ้ำได้แค่ภายในหนึ่ง process เท่านั้น (ข้าม restart จะนับซ้ำได้บ้าง) ใช้ GREATEST เอาค่ามากสุดที่เคยเห็นในชั่วโมงนั้น เป็นค่าประมาณที่ต่ำกว่าจริงเล็กน้อย ยอมรับได้
// ==========================================
async function flushHourly(prisma) {
  if (hourlyBuffer.size === 0) return;
  const entries = [...hourlyBuffer.entries()];
  hourlyBuffer.clear();

  const values = [];
  const params = [];
  entries.forEach(([bucketIso, h]) => {
    const activeUsers = hourlyActiveUsers.get(bucketIso)?.size || 0;
    const row = [
      new Date(bucketIso), h.apiRequests, h.pageViews, h.errorCount, h.clientErrorCount, h.totalDurationMs, h.maxDurationMs, activeUsers,
      h.guest, h.participant, h.staff, h.webmanager, h.mobile, h.desktop, h.chrome, h.safari, h.line, h.other,
    ];
    const placeholders = row.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    values.push(`(${placeholders.join(', ')})`);
  });

  await prisma.$executeRawUnsafe(`
    INSERT INTO usage_hourly_stats (
      bucket_start, api_requests, page_views, error_count, client_error_count, total_duration_ms, max_duration_ms, active_users,
      guest_requests, participant_requests, staff_requests, webmanager_requests, mobile_requests, desktop_requests,
      chrome_requests, safari_requests, line_requests, other_browser_requests
    ) VALUES ${values.join(', ')}
    ON CONFLICT (bucket_start) DO UPDATE SET
      api_requests = usage_hourly_stats.api_requests + EXCLUDED.api_requests,
      page_views = usage_hourly_stats.page_views + EXCLUDED.page_views,
      error_count = usage_hourly_stats.error_count + EXCLUDED.error_count,
      client_error_count = usage_hourly_stats.client_error_count + EXCLUDED.client_error_count,
      total_duration_ms = usage_hourly_stats.total_duration_ms + EXCLUDED.total_duration_ms,
      max_duration_ms = GREATEST(usage_hourly_stats.max_duration_ms, EXCLUDED.max_duration_ms),
      active_users = GREATEST(usage_hourly_stats.active_users, EXCLUDED.active_users),
      guest_requests = usage_hourly_stats.guest_requests + EXCLUDED.guest_requests,
      participant_requests = usage_hourly_stats.participant_requests + EXCLUDED.participant_requests,
      staff_requests = usage_hourly_stats.staff_requests + EXCLUDED.staff_requests,
      webmanager_requests = usage_hourly_stats.webmanager_requests + EXCLUDED.webmanager_requests,
      mobile_requests = usage_hourly_stats.mobile_requests + EXCLUDED.mobile_requests,
      desktop_requests = usage_hourly_stats.desktop_requests + EXCLUDED.desktop_requests,
      chrome_requests = usage_hourly_stats.chrome_requests + EXCLUDED.chrome_requests,
      safari_requests = usage_hourly_stats.safari_requests + EXCLUDED.safari_requests,
      line_requests = usage_hourly_stats.line_requests + EXCLUDED.line_requests,
      other_browser_requests = usage_hourly_stats.other_browser_requests + EXCLUDED.other_browser_requests
  `, ...params);

  // ทิ้ง Set ผู้ใช้ของชั่วโมงที่ผ่านไปแล้ว (เก็บเฉพาะชั่วโมงปัจจุบันไว้นับต่อ) ไม่งั้น memory โตไปเรื่อย ๆ
  const currentHour = toHourBucketIso(new Date());
  [...hourlyActiveUsers.keys()].forEach((key) => {
    if (key !== currentHour) hourlyActiveUsers.delete(key);
  });
}

async function flushEndpoints(prisma) {
  if (endpointBuffer.size === 0) return;
  const entries = [...endpointBuffer.values()];
  endpointBuffer.clear();

  const values = [];
  const params = [];
  entries.forEach((e) => {
    const row = [e.day, e.method, e.route, e.requestCount, e.totalDurationMs, e.maxDurationMs, e.errorCount, e.clientErrorCount];
    const placeholders = row.map((value, index) => {
      params.push(value);
      return index === 0 ? `$${params.length}::date` : `$${params.length}`;
    });
    values.push(`(${placeholders.join(', ')})`);
  });

  await prisma.$executeRawUnsafe(`
    INSERT INTO usage_endpoint_daily_stats (day, method, route, request_count, total_duration_ms, max_duration_ms, error_count, client_error_count)
    VALUES ${values.join(', ')}
    ON CONFLICT (day, method, route) DO UPDATE SET
      request_count = usage_endpoint_daily_stats.request_count + EXCLUDED.request_count,
      total_duration_ms = usage_endpoint_daily_stats.total_duration_ms + EXCLUDED.total_duration_ms,
      max_duration_ms = GREATEST(usage_endpoint_daily_stats.max_duration_ms, EXCLUDED.max_duration_ms),
      error_count = usage_endpoint_daily_stats.error_count + EXCLUDED.error_count,
      client_error_count = usage_endpoint_daily_stats.client_error_count + EXCLUDED.client_error_count
  `, ...params);
}

async function flushActiveUsers(prisma) {
  if (activeUserBuffer.size === 0) return;
  const entries = [...activeUserBuffer.entries()];
  activeUserBuffer.clear();

  const values = [];
  const params = [];
  entries.forEach(([, u]) => {
    params.push(u.day, u.userId, u.role);
    values.push(`($${params.length - 2}::date, $${params.length - 1}, $${params.length})`);
  });

  await prisma.$executeRawUnsafe(`
    INSERT INTO usage_daily_active_users (day, user_id, role) VALUES ${values.join(', ')}
    ON CONFLICT (day, user_id) DO NOTHING
  `, ...params);

  entries.forEach(([key]) => activeUserWritten.add(key));
  // เก็บเฉพาะของวันนี้ไว้กันเขียนซ้ำ ของวันก่อนไม่มีทางถูกนับซ้ำแล้ว ลบทิ้ง
  const today = toBangkokDay(new Date());
  [...activeUserWritten].forEach((key) => {
    if (!key.startsWith(today)) activeUserWritten.delete(key);
  });
}

async function flushUsageStats() {
  if (flushing) return;
  flushing = true;
  try {
    const prisma = await getPrisma();
    await flushHourly(prisma);
    await flushEndpoints(prisma);
    await flushActiveUsers(prisma);
  } catch (error) {
    // ตารางยังไม่ถูกสร้าง (ยังไม่ได้รัน migration) เตือนครั้งเดียวพอ ไม่ต้อง spam ทุกนาที
    const missingTable = /relation .* does not exist/i.test(String(error?.message || ''));
    if (!missingTable || !tablesMissingWarned) {
      console.error('เขียนสถิติการใช้งานลงฐานข้อมูลไม่สำเร็จ:', error?.message || error);
    }
    if (missingTable) tablesMissingWarned = true;
  } finally {
    flushing = false;
  }
}

// เริ่มตัวตั้งเวลาเขียนลง DB - เรียกครั้งเดียวตอน server เริ่ม (unref ไว้ให้ไม่ค้าง process ตอน test/ปิดเซิร์ฟเวอร์)
function startUsageFlushScheduler() {
  if (flushTimer) return;
  flushTimer = setInterval(flushUsageStats, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

module.exports = { usageTracker, startUsageFlushScheduler, flushUsageStats, toBangkokDay, TIMEZONE };
