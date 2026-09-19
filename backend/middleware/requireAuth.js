const { getCampState, describeLockedReason } = require('../lib/campState');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    next();
  };
}

// เข้าถึงหลังบ้าน /admin (และ API ที่ใช้ร่วมกับ /webmanager) ได้เมื่อเป็นพี่ค่ายที่ได้รับสิทธิ์ผู้ดูแลระบบ (StaffProfile.isAdmin) หรือเป็น WebManager (สิทธิ์สูงสุด)
function requireAdminAccess(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  const hasAdminAccess = user.role === 'WEBMANAGER' || (user.role === 'STAFF' && user.isAdmin);
  if (!hasAdminAccess) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
  }
  next();
}

// เข้าถึงหลังบ้าน /webmanager ได้เฉพาะ WebManager (สิทธิ์สูงสุด) เท่านั้น แยกออกจาก Admin โดยสิ้นเชิง
function requireWebManagerAccess(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  if (user.role !== 'WEBMANAGER') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
  }
  next();
}

// ตำแหน่งผู้บริหาร 3 ตำแหน่งเห็น/ทำได้ทุกฝ่าย (ต้องตรงกับ ADMIN_LEADERSHIP_POSITIONS ใน admin.js/webmanager.js/auth.js)
const CAMP_LEADERSHIP_POSITIONS = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ'];

// จัดการกลุ่มน้องค่าย (สร้าง/ลบกลุ่ม, ย้ายสมาชิก) กระทบทุกฝ่ายในค่าย จึงจำกัดเฉพาะผู้บริหารค่าย
// หรือหัวหน้าฝ่ายกิจกรรมและสันทนาการเท่านั้น (ต่างจาก /api/camp-activities ที่พี่ค่ายฝ่ายกิจกรรมทั่วไปใช้ได้)
function requireGroupManagementAccess(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  if (user.role === 'WEBMANAGER') return next();

  const isLeadership = user.role === 'STAFF' && user.position && CAMP_LEADERSHIP_POSITIONS.includes(user.position.name);
  const isActivityHead = user.role === 'STAFF' && user.position?.name === 'หัวหน้าฝ่าย' && user.department?.name === 'ฝ่ายกิจกรรมและสันทนาการ';
  if (!isLeadership && !isActivityHead) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (เฉพาะหัวหน้าฝ่ายกิจกรรมฯ หรือผู้บริหารค่ายเท่านั้น)' });
  }
  next();
}

// เช็คว่า user เป็น "manager" ของงานวิชาการหรือไม่ (ผู้บริหารค่าย หรือหัวหน้าฝ่ายวิชาการ) — ใช้ทั้งใน middleware ด้านล่าง
// และในคอนโทรลเลอร์ที่ต้องเช็คสิทธิ์รายทรัพยากร (เช่น ผู้สอนแก้วิชาตัวเองได้ไหม) เพื่อไม่ให้ตรรกะซ้ำกันสองที่
function isAcademicManager(user) {
  if (!user) return false;
  if (user.role === 'WEBMANAGER') return true;
  const isLeadership = user.role === 'STAFF' && user.position && CAMP_LEADERSHIP_POSITIONS.includes(user.position.name);
  const isAcademicHead = user.role === 'STAFF' && user.position?.name === 'หัวหน้าฝ่าย' && user.department?.name === 'ฝ่ายวิชาการ';
  return isLeadership || isAcademicHead;
}

// จัดการงานวิชาการภาพรวม (วิชา/น้ำหนักคะแนน/ตารางเรียน/เอกสาร/มอบหมายผู้สอน) จำกัดเฉพาะผู้บริหารค่ายหรือหัวหน้าฝ่ายวิชาการ
// ส่วนผู้สอนที่รับผิดชอบวิชาตัวเองมีสิทธิ์แคบกว่านี้ (เช็คแยกในคอนโทรลเลอร์ด้วย isAcademicManager + เจ้าของวิชา)
function requireAcademicManageAccess(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  if (!isAcademicManager(user)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (เฉพาะหัวหน้าฝ่ายวิชาการ หรือผู้บริหารค่ายเท่านั้น)' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requireAdminAccess,
  requireWebManagerAccess,
  requireGroupManagementAccess,
  isAcademicManager,
  requireAcademicManageAccess,
  CAMP_LEADERSHIP_POSITIONS,
};

// ระบบวิชาการ/กิจกรรม (วิชา คะแนน ตารางเรียน เอกสาร สอบอธิบาย กิจกรรม กลุ่ม) ใช้งานได้เฉพาะตอนมีค่ายที่ "กำลังดำเนินการ" เท่านั้น
// ก่อนสร้างค่าย/หลังจบค่าย ตอบ 409 พร้อม code CAMP_NOT_ACTIVE ให้หน้าเว็บโชว์หน้าล็อกแทน (ดู backend/lib/campState.js) - ไม่ยกเว้น WebManager เพราะจำลองพี่ค่ายก็ควรเห็นสภาพเดียวกับพี่ค่ายจริง
function requireActiveCamp(req, res, next) {
  getCampState()
    .then((state) => {
      if (state.isActive) return next();
      res.status(409).json({ error: describeLockedReason(state), code: 'CAMP_NOT_ACTIVE', camp: state });
    })
    .catch(next);
}

module.exports.requireActiveCamp = requireActiveCamp;
