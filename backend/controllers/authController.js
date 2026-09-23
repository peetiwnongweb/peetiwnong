const bcrypt = require('bcryptjs');
const { getPrisma } = require('../lib/prisma');
const { getCampState } = require('../lib/campState');
const { sendOtpEmail, sendApprovalEmail } = require('../lib/mailer');
const { logActivity } = require('../lib/activityLog');
const { buildStaffProfileData, buildParticipantProfileData } = require('./userController');
const { getLatestGenerationNo } = require('../lib/camp');
const { isPasswordValid, PASSWORD_REQUIREMENTS_MESSAGE } = require('../lib/password');
const { CAMP_LEADERSHIP_POSITIONS } = require('../middleware/requireAuth');

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// เช็คสวิตช์เปิด/ปิดลงทะเบียนฝั่ง server (เดิมมีแค่ฝั่งหน้าเว็บที่ซ่อนปุ่ม แต่ยิง API ตรงยังสมัครได้อยู่)
// ไม่มีแถว SiteSetting เลย (ยังไม่เคย upsert) ถือว่าเปิดไว้ตาม default ใน schema
// น้องค่ายสมัครได้เฉพาะตอนมีค่ายที่กำลังดำเนินการเท่านั้น (ก่อนสร้างค่ายยังไม่มีน้องค่ายในระบบเลย - ดู backend/lib/campState.js) พี่ค่ายไม่ผูกกับค่าย สมัครเป็น "ทีมงานค่าย" ได้ตลอด
function isRegistrationOpen(settings, role, campState) {
  const isOpen = role === 'STAFF' ? settings?.staffRegistrationOpen : settings?.participantRegistrationOpen;
  if (isOpen === false) return false;
  if (role === 'PARTICIPANT' && !campState?.isActive) return false;
  return true;
}

// ผู้ใช้ที่เป็น STAFF จะแนบข้อมูลฝ่าย/ตำแหน่ง และสิทธิ์ผู้ดูแลระบบ (isAdmin) ไปกับ session ด้วย
// isAdmin คือสิ่งที่แทนที่ role ADMIN แบบเดิม: พี่ค่ายคนไหนได้รับสิทธิ์นี้จะเข้าหลังบ้าน /admin ได้เหมือน Host
// ผู้ใช้ที่เป็น PARTICIPANT จะแนบข้อมูลโปรไฟล์น้องค่าย (คอร์ส/แผนการเรียน/กลุ่ม ฯลฯ) ไปด้วยเช่นกัน
async function buildSessionUser(prisma, user) {
  const base = { id: user.id, role: user.role, email: user.email, avatarUrl: user.avatarUrl || null };

  if (user.role === 'STAFF') {
    const staffProfile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
      select: {
        prefix: true,
        academicTitle: true,
        firstName: true,
        lastName: true,
        nickname: true,
        birthDate: true,
        phone: true,
        affiliation: true,
        faculty: true,
        major: true,
        occupation: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        isAdmin: true,
      },
    });

    return {
      ...base,
      prefix: staffProfile?.prefix || null,
      academicTitle: staffProfile?.academicTitle || null,
      firstName: staffProfile?.firstName || null,
      lastName: staffProfile?.lastName || null,
      nickname: staffProfile?.nickname || null,
      birthDate: staffProfile?.birthDate || null,
      phone: staffProfile?.phone || null,
      affiliation: staffProfile?.affiliation || null,
      faculty: staffProfile?.faculty || null,
      major: staffProfile?.major || null,
      occupation: staffProfile?.occupation || null,
      department: staffProfile?.department || null,
      position: staffProfile?.position || null,
      // ประธานค่าย/รองประธานค่าย/เลขานุการ ได้สิทธิ์ผู้ดูแลระบบติดตัวมากับตำแหน่งเสมอ ไม่ต้องรอ WebManager มากดให้ทีละคน
      // (ธงในตาราง StaffProfile.isAdmin ยังใช้ได้ตามปกติ สำหรับมอบสิทธิ์ให้พี่ค่ายตำแหน่งอื่นเพิ่มเป็นราย ๆ)
      // คิดตรงนี้จุดเดียวแล้วมีผลทุกที่ที่อ่าน session: requireAdminAccess, requireAdminPage ใน server.js และเมนูฝั่งหน้าเว็บ
      isAdmin: staffProfile?.isAdmin || CAMP_LEADERSHIP_POSITIONS.includes(staffProfile?.position?.name),
    };
  }

  if (user.role === 'PARTICIPANT') {
    const participantProfile = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: {
        prefix: true,
        firstName: true,
        lastName: true,
        nickname: true,
        birthDate: true,
        phone: true,
        parentPhone: true,
        studyPlan: true,
        studyPlanOther: true,
        interestSubjectGroup: true,
        interestSubjectGroupOther: true,
        dreamInstitution: true,
        courseFormat: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return {
      ...base,
      prefix: participantProfile?.prefix || null,
      firstName: participantProfile?.firstName || null,
      lastName: participantProfile?.lastName || null,
      nickname: participantProfile?.nickname || null,
      birthDate: participantProfile?.birthDate || null,
      phone: participantProfile?.phone || null,
      parentPhone: participantProfile?.parentPhone || null,
      studyPlan: participantProfile?.studyPlan || null,
      studyPlanOther: participantProfile?.studyPlanOther || null,
      interestSubjectGroup: participantProfile?.interestSubjectGroup || [],
      interestSubjectGroupOther: participantProfile?.interestSubjectGroupOther || null,
      dreamInstitution: participantProfile?.dreamInstitution || null,
      courseFormat: participantProfile?.courseFormat || null,
      group: participantProfile?.group || null,
    };
  }

  return base;
}

async function login(req, res) {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'ต้องระบุ email, password และ role' });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'email หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'email หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // WebManager มีหน้า login แยกต่างหาก (/webmanager/login.html) ที่ส่ง role: 'WEBMANAGER' ตรง ๆ จึงตรวจ role แบบตรงตัวทุก role
  const roleMatches = user.role === role;
  if (!roleMatches) {
    return res.status(401).json({ error: 'บทบาทที่เลือกไม่ตรงกับบัญชีนี้' });
  }

  // บัญชีที่สมัครเองผ่านฟอร์มสาธารณะต้องรอ WebManager ตรวจสอบและอนุมัติก่อนถึงจะเข้าสู่ระบบได้
  if (user.approvalStatus === 'PENDING') {
    return res.status(403).json({ error: 'บัญชีของคุณอยู่ระหว่างการตรวจสอบและรออนุมัติจากผู้ดูแลระบบ กรุณารอการติดต่อกลับ' });
  }
  if (user.approvalStatus === 'REJECTED') {
    return res.status(403).json({ error: 'คำขอลงทะเบียนของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ' });
  }

  req.session.user = await buildSessionUser(prisma, user);
  res.json({ user: req.session.user });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
}

async function me(req, res) {
  if (!req.session.user) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });

  const prisma = await getPrisma();
  // ดึงข้อมูลฝ่าย/ตำแหน่งล่าสุดทุกครั้ง เผื่อแอดมินแก้ไขโปรไฟล์พี่ค่ายระหว่างที่ session ยังอยู่
  req.session.user = await buildSessionUser(prisma, req.session.user);
  // สถานะค่ายแนบไปด้วยทุกครั้ง ให้หน้าพี่ค่าย/น้องค่ายรู้ตั้งแต่โหลดว่าระบบวิชาการ/กิจกรรมล็อกอยู่ไหม (ดู backend/lib/campState.js) ไม่ต้องยิง API เพิ่ม
  res.json({ user: req.session.user, camp: await getCampState(prisma) });
}

// พี่ค่ายเปลี่ยนรูปโปรไฟล์ของตัวเองได้ ไม่ต้องรอแอดมิน: เลือกจากคลังภาพ (/assets/images/avatars/...) หรือใส่ URL เองก็ได้
async function updateAvatar(req, res) {
  if (!req.session.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  if (req.session.user.role === 'WEBMANAGER') {
    return res.status(403).json({ error: 'บัญชี Owner ใช้รูปโปรไฟล์คงที่ ไม่สามารถเปลี่ยนได้' });
  }

  const { avatarUrl } = req.body;
  if (typeof avatarUrl !== 'string' || !avatarUrl.trim()) {
    return res.status(400).json({ error: 'ต้องระบุ avatarUrl' });
  }
  const trimmed = avatarUrl.trim();
  if (trimmed.length > 500 || !/^(https?:\/\/|\/)/.test(trimmed)) {
    return res.status(400).json({ error: 'URL รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย / หรือ http(s)://' });
  }

  const prisma = await getPrisma();
  const updated = await prisma.user.update({
    where: { id: req.session.user.id },
    data: { avatarUrl: trimmed },
  });

  req.session.user = await buildSessionUser(prisma, updated);
  res.json({ user: req.session.user });
}

// น้องค่ายดูรายชื่อเพื่อนร่วมกลุ่มเดียวกับตัวเองได้ (ยังไม่ถูกจัดกลุ่ม = คืน array ว่าง)
async function getMyGroupMembers(req, res) {
  if (!req.session.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  if (req.session.user.role !== 'PARTICIPANT') {
    return res.status(403).json({ error: 'ใช้ได้เฉพาะบัญชีน้องค่ายเท่านั้น' });
  }

  const prisma = await getPrisma();
  const myProfile = await prisma.participantProfile.findUnique({
    where: { userId: req.session.user.id },
    select: { groupId: true },
  });

  if (!myProfile || !myProfile.groupId) {
    return res.json({ members: [] });
  }

  const members = await prisma.participantProfile.findMany({
    where: { groupId: myProfile.groupId },
    select: {
      userId: true,
      prefix: true,
      firstName: true,
      lastName: true,
      nickname: true,
      user: { select: { avatarUrl: true } },
    },
    orderBy: { firstName: 'asc' },
  });

  res.json({
    members: members.map((member) => ({
      userId: member.userId,
      prefix: member.prefix,
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      avatarUrl: member.user.avatarUrl,
      isMe: member.userId === req.session.user.id,
    })),
  });
}

// พี่ค่ายเปลี่ยนรหัสผ่านของตัวเอง ต้องยืนยันรหัสผ่านปัจจุบันให้ถูกต้องก่อนเสมอ
async function changePassword(req, res) {
  if (!req.session.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'ต้องระบุรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
  }
  if (!isPasswordValid(newPassword)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { id: req.session.user.id } });
  const currentOk = user && (await bcrypt.compare(currentPassword, user.passwordHash));
  if (!currentOk) {
    return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
}

// ขอรหัส OTP สำหรับ "สมัครลงทะเบียน" (ยังไม่มีบัญชี User อยู่จริง ต่างจาก forgotPassword ที่มีบัญชีอยู่แล้ว)
// เก็บ OTP ไว้ใน session ชั่วคราวแทนการเก็บลง DB เพราะยังไม่มีแถว User ให้ผูกไว้
async function requestRegistrationOtp(req, res) {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'ต้องระบุ email และ role' });
  if (!['STAFF', 'PARTICIPANT'].includes(role)) {
    return res.status(400).json({ error: 'role ต้องเป็น STAFF หรือ PARTICIPANT เท่านั้น' });
  }

  const prisma = await getPrisma();
  const [settings, campState] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: 1 } }),
    getCampState(prisma),
  ]);
  if (!isRegistrationOpen(settings, role, campState)) {
    const label = role === 'STAFF' ? 'พี่ค่าย' : 'น้องค่าย';
    const message = role === 'PARTICIPANT' && !campState.isActive
      ? 'ยังไม่มีค่ายที่กำลังดำเนินการ สมัครน้องค่ายได้เมื่อค่ายเริ่มดำเนินการแล้ว'
      : `ขณะนี้ยังไม่เปิดรับลงทะเบียน${label}`;
    return res.status(403).json({ error: message });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'มีอีเมลนี้อยู่แล้วในระบบ' });
  }

  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  req.session.pendingRegistration = { email, otpCode, otpExpiresAt: otpExpiresAt.toISOString(), role };

  try {
    await sendOtpEmail(email, otpCode, 'register');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  }

  res.json({ message: 'ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย' });
}

// ยืนยัน OTP + สร้างบัญชีจริงพร้อมโปรไฟล์ครบถ้วน สถานะเริ่มต้นเป็น PENDING รอ WebManager อนุมัติ ไม่ล็อกอินให้ทันที
async function completeRegistration(req, res) {
  const { email, otpCode, password, role, profile } = req.body;
  if (!email || !otpCode || !password || !role || !profile) {
    return res.status(400).json({ error: 'ต้องระบุ email, otpCode, password, role และ profile ให้ครบถ้วน' });
  }
  if (!['STAFF', 'PARTICIPANT'].includes(role)) {
    return res.status(400).json({ error: 'role ต้องเป็น STAFF หรือ PARTICIPANT เท่านั้น' });
  }
  if (!isPasswordValid(password)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }

  const pending = req.session.pendingRegistration;
  const otpValid = pending
    && pending.email === email
    && pending.role === role
    && pending.otpCode === otpCode
    && new Date(pending.otpExpiresAt) > new Date();
  if (!otpValid) {
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่' });
  }

  const prisma = await getPrisma();
  const [settings, campState] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: 1 } }),
    getCampState(prisma),
  ]);
  if (!isRegistrationOpen(settings, role, campState)) {
    const label = role === 'STAFF' ? 'พี่ค่าย' : 'น้องค่าย';
    const message = role === 'PARTICIPANT' && !campState.isActive
      ? 'ยังไม่มีค่ายที่กำลังดำเนินการ สมัครน้องค่ายได้เมื่อค่ายเริ่มดำเนินการแล้ว'
      : `ขณะนี้ยังไม่เปิดรับลงทะเบียน${label}`;
    return res.status(403).json({ error: message });
  }

  // ฟอร์มสาธารณะเลือกฝ่ายงาน/คอร์สเรียนเป็นชื่อ (ไม่มี id จริงให้เลือกเหมือนหน้า WebManager) จึงต้อง lookup ชื่อ -> id เองที่นี่
  // ก่อนส่งต่อให้ buildStaffProfileData/buildParticipantProfileData ที่รับแค่ departmentId/courseFormatId เป็นตัวเลข
  const resolvedProfile = { ...profile };
  if (role === 'STAFF' && profile.department) {
    const department = await prisma.campDepartment.findFirst({ where: { name: profile.department } });
    if (!department) return res.status(400).json({ error: 'ฝ่ายงานไม่ถูกต้อง' });
    resolvedProfile.departmentId = department.id;
  }
  if (role === 'PARTICIPANT' && profile.courseFormat) {
    const courseFormat = await prisma.courseFormat.findFirst({ where: { name: profile.courseFormat } });
    if (!courseFormat) return res.status(400).json({ error: 'รูปแบบคอร์สเรียนไม่ถูกต้อง' });
    resolvedProfile.courseFormatId = courseFormat.id;
  }
  // ฟอร์มสาธารณะไม่มีให้เลือกตำแหน่งเอง (กันคนสมัครเองอ้างตำแหน่งผู้บริหาร) ตั้งเป็น "ทีมงานค่าย" ให้อัตโนมัติ แอดมินค่อยปรับภายหลังได้
  if (role === 'STAFF') {
    const defaultPosition = await prisma.staffPosition.findFirst({ where: { name: 'ทีมงานค่าย' } });
    if (defaultPosition) resolvedProfile.positionId = defaultPosition.id;
  }

  let profileData;
  if (role === 'STAFF') {
    const result = buildStaffProfileData(resolvedProfile);
    if (result.error) return res.status(400).json({ error: result.error });
    profileData = result.data;
  } else {
    const result = buildParticipantProfileData(resolvedProfile);
    if (result.error) return res.status(400).json({ error: result.error });
    profileData = result.data;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'มีอีเมลนี้อยู่แล้วในระบบ' });
  }

  // แอดมินเปิดสวิตช์ "อนุมัติอัตโนมัติ" ไว้ในหน้าแรก WebManager ได้ ถ้าเปิดไว้บัญชีที่สมัครเข้ามาจะอนุมัติทันทีโดยไม่ต้องรอตรวจสอบ
  // (ใช้ settings ตัวเดียวกับที่ query ไปแล้วตอนเช็ค isRegistrationOpen ด้านบน ไม่ query ซ้ำ)
  const autoApprove = role === 'STAFF' ? settings?.staffAutoApprove : settings?.participantAutoApprove;
  const approvalStatus = autoApprove ? 'APPROVED' : 'PENDING';

  const passwordHash = await bcrypt.hash(password, 10);
  // ฝั่งพี่ค่าย: ครั้งที่จัดค่ายล่าสุด เป็นแค่ audit trail เฉยๆ (ไม่ผูกกับการสร้างรหัสอะไร) ประทับตั้งแต่ตอนลงทะเบียนได้เลยเหมือน userController.js
  // ฝั่งน้องค่าย: ค่านี้ใช้สร้าง "รหัสประจำตัวน้องค่าย" จริง ต้องประทับก็ต่อเมื่ออนุมัติแล้วเท่านั้น (ที่นี่คือกรณีเปิด "อนุมัติอัตโนมัติ" ไว้เลยได้ APPROVED ทันที) ถ้ายัง PENDING อยู่ปล่อยเป็น null รอประทับตอนอนุมัติจริงที่ userController.js
  const staffLatestGenerationNo = role === 'STAFF' ? await getLatestGenerationNo(prisma) : null;
  const participantLatestGenerationNo = role === 'PARTICIPANT' && approvalStatus === 'APPROVED' ? await getLatestGenerationNo(prisma) : null;
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      approvalStatus,
      ...(role === 'STAFF'
        ? { staffProfile: { create: { ...profileData, campGenerationNo: staffLatestGenerationNo } } }
        : { participantProfile: { create: { ...profileData, campGenerationNo: participantLatestGenerationNo } } }),
    },
  });

  delete req.session.pendingRegistration;

  await logActivity({
    actorEmail: created.email,
    actorRole: created.role,
    action: 'CREATE',
    entityType: 'USER',
    entityId: created.id,
    summary: `สมัครลงทะเบียน${role === 'STAFF' ? 'พี่ค่าย' : 'น้องค่าย'} "${created.email}" (${autoApprove ? 'อนุมัติอัตโนมัติ' : 'รอการอนุมัติ'})`,
  });

  if (autoApprove) {
    sendApprovalEmail(created.email, created.role).catch((error) => {
      console.error('ส่งอีเมลแจ้งอนุมัติไม่สำเร็จ:', error);
    });
  }

  res.status(201).json({
    message: autoApprove
      ? 'ลงทะเบียนสำเร็จ! บัญชีของคุณได้รับการอนุมัติอัตโนมัติ สามารถเข้าสู่ระบบได้ทันที'
      : 'ลงทะเบียนสำเร็จ บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ',
  });
}

// หน้าสาธารณะ "ตรวจสอบผลการลงทะเบียน" ใช้เช็คสถานะด้วยอีเมล ไม่ต้องเข้าสู่ระบบ
// คืนแค่สถานะอนุมัติเท่านั้น ไม่คืนข้อมูลโปรไฟล์อื่นใด กันข้อมูลรั่วไหลถ้ามีคนกรอกอีเมลของคนอื่น
async function checkRegistrationStatus(req, res) {
  const { email, role } = req.query;
  if (!email || !role) return res.status(400).json({ error: 'ต้องระบุ email และ role' });
  if (!['STAFF', 'PARTICIPANT'].includes(role)) {
    return res.status(400).json({ error: 'role ต้องเป็น STAFF หรือ PARTICIPANT เท่านั้น' });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findFirst({ where: { email, role }, select: { approvalStatus: true } });

  if (!user) return res.json({ found: false });
  res.json({ found: true, approvalStatus: user.approvalStatus });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'ต้องระบุ email' });

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง' });
  }

  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.user.update({ where: { id: user.id }, data: { otpCode, otpExpiresAt } });

  try {
    await sendOtpEmail(user.email, otpCode);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  }

  res.json({ message: 'ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย' });
}

async function verifyOtp(req, res) {
  const { email, otpCode } = req.body;
  if (!email || !otpCode) {
    return res.status(400).json({ error: 'ต้องระบุ email และ otpCode' });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });

  // ยังไม่เคลียร์ otpCode ที่ขั้นตอนนี้ เพราะต้องใช้ซ้ำตอนบันทึกรหัสผ่านใหม่จริงในขั้นถัดไป
  const otpValid = user && user.otpCode === otpCode && user.otpExpiresAt && user.otpExpiresAt > new Date();
  if (!otpValid) {
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว' });
  }

  res.json({ valid: true });
}

async function resetPassword(req, res) {
  const { email, otpCode, newPassword } = req.body;
  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ error: 'ต้องระบุ email, otpCode และ newPassword' });
  }
  if (!isPasswordValid(newPassword)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });

  const otpValid = user && user.otpCode === otpCode && user.otpExpiresAt && user.otpExpiresAt > new Date();
  if (!otpValid) {
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, otpCode: null, otpExpiresAt: null },
  });

  res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' });
}

module.exports = { login, logout, me, updateAvatar, getMyGroupMembers, changePassword, requestRegistrationOtp, completeRegistration, checkRegistrationStatus, forgotPassword, verifyOtp, resetPassword };
