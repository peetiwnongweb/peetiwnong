const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// นับต่อ "IP + อีเมลที่ส่งมา" กันเดารหัสของบัญชีใดบัญชีหนึ่งรัว ๆ จากหลาย IP ไม่ได้ผลเท่านับต่อ IP อย่างเดียว
// (req.ip ใช้งานได้ถูกต้องเพราะ server.js ตั้ง trust proxy ไว้แล้ว ไม่งั้นทุกคนหลัง reverse proxy จะเห็นเป็น IP เดียวกันหมด)
// ต้องครอบ req.ip ด้วย ipKeyGenerator ก่อนเสมอ (ไม่ใช้ req.ip ดิบ ๆ) เพราะ v8 บังคับ - IPv6 ต้องตัดเหลือแค่ /64 prefix ไม่งั้นคนเลี่ยง limit ได้ง่าย ๆ แค่เปลี่ยนกลุ่มท้าย IPv6 ของตัวเอง
function ipAndEmailKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${ipKeyGenerator(req.ip)}|${email}`;
}

const tooManyMessage = (message) => ({
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
});

// ล็อกอิน: ผิดได้ 10 ครั้ง/15 นาที ต่อ IP+อีเมล (ครั้งที่สำเร็จไม่นับ)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: ipAndEmailKey,
  ...tooManyMessage('พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'),
});

// ขอ OTP (สมัคร/ลืมรหัสผ่าน): 5 ครั้ง/15 นาที ต่อ IP+อีเมล - กันยิงส่งอีเมลรัว ๆ ใส่คนอื่น และกันเผาโควตา Gmail 500 ฉบับ/วัน
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: ipAndEmailKey,
  ...tooManyMessage('ขอรหัส OTP บ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'),
});

// ยืนยัน OTP / ตั้งรหัสใหม่ / สมัครให้เสร็จ: 10 ครั้ง/15 นาที ต่อ IP+อีเมล - OTP 6 หลักหมดอายุ 10 นาที ถ้าเดาได้ไม่จำกัดจะเดาถูกได้ในเวลาไม่นาน
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: ipAndEmailKey,
  ...tooManyMessage('กรอกรหัส OTP ผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่แล้วลองอีกครั้งใน 15 นาที'),
});

module.exports = { loginLimiter, otpRequestLimiter, otpVerifyLimiter };
