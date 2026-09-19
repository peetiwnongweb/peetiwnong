const bcrypt = require('bcryptjs');
const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { sendApprovalEmail } = require('../lib/mailer');
const { getLatestGenerationNo } = require('../lib/camp');
const { isPasswordValid, PASSWORD_REQUIREMENTS_MESSAGE } = require('../lib/password');

const VALID_ROLES = ['WEBMANAGER', 'STAFF', 'PARTICIPANT'];
// บัญชี Owner ทุกบัญชีใช้รูปโปรไฟล์คงที่รูปเดียวกัน (ล็อกไว้ เปลี่ยนไม่ได้ - ดู updateAvatar ใน authController.js)
const WEBMANAGER_AVATAR_URL = '/assets/images/avatars/webmanager/1.png';
const VALID_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const PHONE_PATTERN = /^0\d{8,9}$/;
const STUDY_PLANS = ['SCIENCE_MATH', 'ARTS_MATH', 'ARTS_LANGUAGE', 'ARTS_SOCIAL', 'OTHER'];
const INTEREST_SUBJECT_GROUPS = ['ENGINEERING_TECH', 'SCIENCE', 'HEALTH', 'EDUCATION', 'HUMANITIES_SOCIAL', 'ART_DESIGN', 'MEDIA_DIGITAL_TECH', 'BUSINESS', 'OTHER'];

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  role: true,
  approvalStatus: true,
  createdAt: true,
  updatedAt: true,
  staffProfile: {
    select: {
      isAdmin: true,
      prefix: true,
      academicTitle: true,
      firstName: true,
      lastName: true,
      nickname: true,
      birthDate: true,
      phone: true,
      affiliation: true,
      occupation: true,
      faculty: true,
      major: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  },
  participantProfile: {
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
  },
};

// สิทธิ์ผู้ดูแลระบบตอนนี้ไม่ใช่ role ADMIN แยกต่างหากอีกต่อไป แต่เป็น StaffProfile.isAdmin ที่มอบให้พี่ค่ายได้
// ฟังก์ชันนี้แปลงผลลัพธ์จาก Prisma (ที่มี staffProfile/participantProfile ซ้อนอยู่) ให้เป็นก้อนข้อมูลแบนราบสำหรับส่งกลับ client
// รวมฟิลด์โปรไฟล์ทั้งหมดไว้ด้วย เพื่อให้หน้า "อนุมัติการลงทะเบียน" เปิดดูรายละเอียดทั้งหมดก่อนอนุมัติได้ (ยกเว้นรหัสผ่านซึ่งไม่ถูกส่งออกมาอยู่แล้ว)
function toSafeUser(user) {
  const { staffProfile, participantProfile, ...rest } = user;
  const profile = staffProfile || participantProfile;
  return {
    ...rest,
    isAdmin: staffProfile?.isAdmin || false,
    prefix: profile?.prefix || null,
    academicTitle: staffProfile?.academicTitle || null,
    firstName: profile?.firstName || null,
    lastName: profile?.lastName || null,
    nickname: profile?.nickname || null,
    birthDate: profile?.birthDate || null,
    phone: profile?.phone || null,
    parentPhone: participantProfile?.parentPhone || null,
    affiliation: staffProfile?.affiliation || null,
    occupation: staffProfile?.occupation || null,
    faculty: staffProfile?.faculty || null,
    major: staffProfile?.major || null,
    department: staffProfile?.department || null,
    position: staffProfile?.position || null,
    courseFormat: participantProfile?.courseFormat || null,
    studyPlan: participantProfile?.studyPlan || null,
    studyPlanOther: participantProfile?.studyPlanOther || null,
    interestSubjectGroup: participantProfile?.interestSubjectGroup || [],
    interestSubjectGroupOther: participantProfile?.interestSubjectGroupOther || null,
    dreamInstitution: participantProfile?.dreamInstitution || null,
    group: participantProfile?.group || null,
  };
}

async function listUsers(req, res) {
  const prisma = await getPrisma();
  const where = {
    ...(req.query.role && VALID_ROLES.includes(req.query.role) && { role: req.query.role }),
    ...(req.query.approvalStatus && VALID_APPROVAL_STATUSES.includes(req.query.approvalStatus) && { approvalStatus: req.query.approvalStatus }),
  };
  const users = await prisma.user.findMany({ where, select: USER_SAFE_SELECT, orderBy: { createdAt: 'desc' } });
  res.json(users.map(toSafeUser));
}

// ใช้ตอนสร้างบัญชีพี่ค่ายแบบเต็มรูปแบบ (หน้า "สร้างบัญชีผู้ใช้") ตรวจ+แปลง profile ที่ส่งมาให้เป็นข้อมูลสำหรับ StaffProfile.create
// คืนค่า { error } ถ้าข้อมูลไม่ถูกต้อง หรือ { data } ถ้าผ่าน
function buildStaffProfileData(profile) {
  const phoneDigits = (profile.phone || '').replace(/\D/g, '');
  if (profile.phone && !PHONE_PATTERN.test(phoneDigits)) {
    return { error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
  }
  let birthDate;
  if (profile.birthDate) {
    birthDate = new Date(profile.birthDate);
    if (Number.isNaN(birthDate.getTime())) return { error: 'วันเกิดไม่ถูกต้อง' };
  }
  return {
    data: {
      prefix: profile.prefix || null,
      academicTitle: profile.academicTitle || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      nickname: profile.nickname || null,
      birthDate,
      phone: phoneDigits || null,
      departmentId: profile.departmentId ? Number(profile.departmentId) : null,
      positionId: profile.positionId ? Number(profile.positionId) : null,
      affiliation: profile.affiliation || null,
      faculty: profile.faculty || null,
      major: profile.major || null,
      occupation: profile.occupation || null,
    },
  };
}

// เหมือน buildStaffProfileData แต่สำหรับ ParticipantProfile.create
function buildParticipantProfileData(profile) {
  const phoneDigits = (profile.phone || '').replace(/\D/g, '');
  if (profile.phone && !PHONE_PATTERN.test(phoneDigits)) {
    return { error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
  }
  const parentPhoneDigits = (profile.parentPhone || '').replace(/\D/g, '');
  if (profile.parentPhone && !PHONE_PATTERN.test(parentPhoneDigits)) {
    return { error: 'เบอร์โทรผู้ปกครองไม่ถูกต้อง' };
  }
  if (profile.studyPlan && !STUDY_PLANS.includes(profile.studyPlan)) {
    return { error: 'แผนการเรียนไม่ถูกต้อง' };
  }
  const studyPlanOther = profile.studyPlan === 'OTHER' ? (profile.studyPlanOther || '').trim() : '';
  if (profile.studyPlan === 'OTHER' && !studyPlanOther) {
    return { error: 'กรุณาระบุแผนการเรียน' };
  }
  const interestSubjectGroup = Array.isArray(profile.interestSubjectGroup) ? profile.interestSubjectGroup : [];
  if (interestSubjectGroup.some((value) => !INTEREST_SUBJECT_GROUPS.includes(value))) {
    return { error: 'กลุ่มวิชาที่สนใจไม่ถูกต้อง' };
  }
  const interestSubjectGroupOther = interestSubjectGroup.includes('OTHER') ? (profile.interestSubjectGroupOther || '').trim() : '';
  if (interestSubjectGroup.includes('OTHER') && !interestSubjectGroupOther) {
    return { error: 'กรุณาระบุกลุ่มวิชาที่สนใจ' };
  }
  let birthDate;
  if (profile.birthDate) {
    birthDate = new Date(profile.birthDate);
    if (Number.isNaN(birthDate.getTime())) return { error: 'วันเกิดไม่ถูกต้อง' };
  }
  return {
    data: {
      prefix: profile.prefix || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      nickname: profile.nickname || null,
      birthDate,
      phone: phoneDigits || null,
      parentPhone: parentPhoneDigits || null,
      courseFormatId: profile.courseFormatId ? Number(profile.courseFormatId) : null,
      studyPlan: profile.studyPlan || null,
      studyPlanOther: studyPlanOther || null,
      interestSubjectGroup,
      interestSubjectGroupOther: interestSubjectGroupOther || null,
      dreamInstitution: profile.dreamInstitution || null,
      groupId: profile.groupId ? Number(profile.groupId) : null,
    },
  };
}

async function createUser(req, res) {
  const { email, password, role, isAdmin, profile } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'ต้องระบุ email, password และ role' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role ต้องเป็นหนึ่งใน ${VALID_ROLES.join(', ')}` });
  }
  if (!isPasswordValid(password)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }
  if (role === 'WEBMANAGER' && req.session.user.role !== 'WEBMANAGER') {
    return res.status(403).json({ error: 'เฉพาะ WebManager เท่านั้นที่จัดการบัญชี WebManager ได้' });
  }
  if (isAdmin && req.session.user.role !== 'WEBMANAGER') {
    return res.status(403).json({ error: 'เฉพาะ WebManager เท่านั้นที่มอบสิทธิ์ผู้ดูแลระบบให้พี่ค่ายได้' });
  }

  // profile เป็นข้อมูลเสริม (ชื่อ-นามสกุล/ฝ่าย/ตำแหน่ง ฯลฯ) ส่งมาเฉพาะตอนสร้างจากหน้า "สร้างบัญชีผู้ใช้" เท่านั้น
  // ส่วนการเพิ่มแบบเร็วในหน้า "จัดการผู้ใช้งาน" (แค่ email/password/role) ยังทำงานได้เหมือนเดิมเพราะไม่ส่ง profile มา
  let staffProfileData;
  let participantProfileData;
  if (profile && role === 'STAFF') {
    const result = buildStaffProfileData(profile);
    if (result.error) return res.status(400).json({ error: result.error });
    staffProfileData = result.data;
  } else if (profile && role === 'PARTICIPANT') {
    const result = buildParticipantProfileData(profile);
    if (result.error) return res.status(400).json({ error: result.error });
    participantProfileData = result.data;
  }

  const prisma = await getPrisma();

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return res.status(409).json({ error: 'มีอีเมลนี้อยู่แล้ว' });

  const passwordHash = await bcrypt.hash(password, 10);
  const needsStaffProfile = role === 'STAFF' && (isAdmin || staffProfileData);
  // ครั้งที่จัดค่ายล่าสุด (audit trail) - ประทับไว้ตอนสร้างโปรไฟล์เท่านั้น ไม่ผูกกับตำแหน่งจริงซึ่งถูกรีเซ็ตอิสระผ่าน "จบค่าย"
  const latestGenerationNo = await getLatestGenerationNo(prisma);
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      ...(role === 'WEBMANAGER' ? { avatarUrl: WEBMANAGER_AVATAR_URL } : {}),
      ...(needsStaffProfile ? { staffProfile: { create: { ...staffProfileData, isAdmin: !!isAdmin, campGenerationNo: latestGenerationNo } } } : {}),
      ...(participantProfileData ? { participantProfile: { create: { ...participantProfileData, campGenerationNo: latestGenerationNo } } } : {}),
    },
    select: USER_SAFE_SELECT,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'USER',
    entityId: created.id,
    summary: `เพิ่มผู้ใช้งาน "${created.email}" (${created.role}${role === 'STAFF' && isAdmin ? ', ผู้ดูแลระบบ' : ''})`,
  });

  res.status(201).json(toSafeUser(created));
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { email, password, role, isAdmin, approvalStatus, profile } = req.body;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role ต้องเป็นหนึ่งใน ${VALID_ROLES.join(', ')}` });
  }
  if (password && !isPasswordValid(password)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }
  if (approvalStatus !== undefined && !VALID_APPROVAL_STATUSES.includes(approvalStatus)) {
    return res.status(400).json({ error: `approvalStatus ต้องเป็นหนึ่งใน ${VALID_APPROVAL_STATUSES.join(', ')}` });
  }

  const prisma = await getPrisma();
  try {
    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true, approvalStatus: true, email: true } });
    if (!existing) return res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการแก้ไข' });

    const targetRole = role !== undefined ? role : existing.role;
    if ((existing.role === 'WEBMANAGER' || targetRole === 'WEBMANAGER') && req.session.user.role !== 'WEBMANAGER') {
      return res.status(403).json({ error: 'เฉพาะ WebManager เท่านั้นที่จัดการบัญชี WebManager ได้' });
    }
    if (isAdmin !== undefined && req.session.user.role !== 'WEBMANAGER') {
      return res.status(403).json({ error: 'เฉพาะ WebManager เท่านั้นที่มอบสิทธิ์ผู้ดูแลระบบให้พี่ค่ายได้' });
    }

    // profile เป็นข้อมูลเสริม (ชื่อ-นามสกุล/ฝ่าย/ตำแหน่ง ฯลฯ) เหมือนตอนสร้างบัญชีจากหน้า "สร้างบัญชีผู้ใช้"
    // ตรวจสอบให้ผ่านก่อนเขียนอะไรลง DB (fail fast เหมือน createUser)
    let staffProfileData;
    let participantProfileData;
    if (profile && targetRole === 'STAFF') {
      const result = buildStaffProfileData(profile);
      if (result.error) return res.status(400).json({ error: result.error });
      staffProfileData = result.data;
    } else if (profile && targetRole === 'PARTICIPANT') {
      const result = buildParticipantProfileData(profile);
      if (result.error) return res.status(400).json({ error: result.error });
      participantProfileData = result.data;
    }

    const data = {
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(approvalStatus !== undefined && { approvalStatus }),
    };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({ where: { id }, data });

    // ครั้งที่จัดค่ายล่าสุด (audit trail) - ประทับเฉพาะฝั่ง create ของ upsert เท่านั้น ไม่ทับค่าเดิมตอนแก้ไขโปรไฟล์ที่มีอยู่แล้ว
    if ((isAdmin !== undefined || staffProfileData) && targetRole === 'STAFF') {
      const latestGenerationNo = await getLatestGenerationNo(prisma);
      await prisma.staffProfile.upsert({
        where: { userId: id },
        update: { ...staffProfileData, ...(isAdmin !== undefined && { isAdmin: !!isAdmin }) },
        create: { userId: id, ...staffProfileData, isAdmin: !!isAdmin, campGenerationNo: latestGenerationNo },
      });
    }

    if (participantProfileData) {
      const latestGenerationNo = await getLatestGenerationNo(prisma);
      await prisma.participantProfile.upsert({
        where: { userId: id },
        update: participantProfileData,
        create: { userId: id, ...participantProfileData, campGenerationNo: latestGenerationNo },
      });
    }

    // ครั้งที่จัดค่ายล่าสุด (audit trail) ของน้องค่ายใช้สร้าง "รหัสประจำตัวน้องค่าย" จริง (ดู buildParticipantCode ใน lib/camp.js) - ต้องประทับตอนอนุมัติจริงเท่านั้น ไม่ใช่ตอนลงทะเบียน (กันขยับถ้ารออนุมัตินานข้ามค่ายรุ่นถัดไป)
    // เช็คว่ายัง null อยู่ก่อนกันทับค่าเดิมถ้าเคยอนุมัติ/ประทับไปแล้วรอบก่อน (เช่น ปฏิเสธแล้วอนุมัติใหม่)
    if (approvalStatus === 'APPROVED' && targetRole === 'PARTICIPANT') {
      const participantProfileRow = await prisma.participantProfile.findUnique({ where: { userId: id }, select: { campGenerationNo: true } });
      if (participantProfileRow && participantProfileRow.campGenerationNo === null) {
        const latestGenerationNo = await getLatestGenerationNo(prisma);
        await prisma.participantProfile.update({ where: { userId: id }, data: { campGenerationNo: latestGenerationNo } });
      }
    }

    const updated = await prisma.user.findUnique({ where: { id }, select: USER_SAFE_SELECT });

    const approvalLabels = { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติ', REJECTED: 'ปฏิเสธ' };
    const summary = approvalStatus !== undefined
      ? `${approvalLabels[approvalStatus]}การลงทะเบียนของ "${updated.email}"`
      : `แก้ไขผู้ใช้งาน "${updated.email}"`;

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: updated.id,
      summary,
    });

    // แจ้งอีเมลเฉพาะตอน "เปลี่ยนเป็นอนุมัติ" จริง ๆ (จากสถานะอื่น) ไม่ส่งซ้ำถ้าแก้ไขอย่างอื่นตอนที่อนุมัติอยู่แล้ว
    // ส่งไม่สำเร็จก็ไม่ทำให้การอนุมัติล้มเหลว (บัญชีอนุมัติไปแล้วจริง แค่แจ้งเตือนไม่ถึง)
    if (approvalStatus === 'APPROVED' && existing.approvalStatus !== 'APPROVED') {
      sendApprovalEmail(existing.email, updated.role).catch((error) => {
        console.error('ส่งอีเมลแจ้งอนุมัติไม่สำเร็จ:', error);
      });
    }

    res.json(toSafeUser(updated));
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการแก้ไข' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    throw error;
  }
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);

  if (req.session.user.id === id) {
    return res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' });
  }

  const prisma = await getPrisma();
  try {
    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!existing) return res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการลบ' });
    if (existing.role === 'WEBMANAGER' && req.session.user.role !== 'WEBMANAGER') {
      return res.status(403).json({ error: 'เฉพาะ WebManager เท่านั้นที่จัดการบัญชี WebManager ได้' });
    }
    // บัญชี WebManager ที่สร้างไว้ก่อนใคร (createdAt เก่าสุด) คือบัญชีพื้นฐานของระบบ ลบไม่ได้เด็ดขาดไม่ว่าใครจะล็อกอินอยู่ก็ตาม กันระบบไม่มี Owner เหลือเลย
    if (existing.role === 'WEBMANAGER') {
      const baseOwner = await prisma.user.findFirst({ where: { role: 'WEBMANAGER' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (baseOwner && baseOwner.id === id) {
        return res.status(400).json({ error: 'ไม่สามารถลบบัญชีนี้ได้ เพราะเป็นบัญชีพื้นฐานของระบบ' });
      }
    }

    const deleted = await prisma.user.delete({ where: { id }, select: USER_SAFE_SELECT });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'USER',
      entityId: deleted.id,
      summary: `ลบผู้ใช้งาน "${deleted.email}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการลบ' });
    throw error;
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser, buildStaffProfileData, buildParticipantProfileData };
