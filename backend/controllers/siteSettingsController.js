const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { getCampState } = require('../lib/campState');
const { getSiteSettingsRow, invalidateSiteSettingsCache } = require('../lib/siteSettings');

// ตั้งค่าเว็บไซต์มีแถวเดียวตายตัว (id=1) ใช้ upsert เพื่อให้ยังทำงานได้แม้ยังไม่เคยมีแถวนี้มาก่อน (ไม่ต้อง seed แยก)
async function getSiteSettings(req, res) {
  const prisma = await getPrisma();
  const [settings, campState] = await Promise.all([
    getSiteSettingsRow(prisma),
    getCampState(prisma),
  ]);
  // campActive แนบไปด้วยให้หน้าเว็บ (ผู้เยี่ยมชมที่ยังไม่ล็อกอินก็เรียก endpoint นี้ได้) รู้ว่าน้องค่ายสมัครได้จริงไหม
  // participantRegistrationOpen ดิบยังคงคืนตามที่ตั้งค่าไว้ (ให้ WebManager เห็นค่าที่ตัวเองตั้ง) แต่ "เปิดใช้งานจริง" ต้องมีค่ายที่กำลังดำเนินการด้วยเสมอ (ดู isRegistrationOpen ใน authController.js)
  res.json({ ...settings, campActive: campState.isActive });
}

async function updateSiteSettings(req, res) {
  const {
    heroCardVisible, staffRegistrationOpen, participantRegistrationOpen,
    staffAutoApprove, participantAutoApprove, newsAutoApprove,
    checkRegistrationVisibleStaff, checkRegistrationVisibleParticipant,
    committeeSectionVisible, newsSectionVisible, historyTitle, historyBody,
  } = req.body;

  const prisma = await getPrisma();
  // กันเปิดสวิตช์ที่ผูกกับข้อมูลจริงทั้งที่ยังไม่มีข้อมูลเลย (จะไปโชว์ส่วนว่าง/รูปพังที่หน้าแรก) เช็คฝั่ง server ด้วย ไม่พึ่งแค่ disable ปุ่มฝั่ง UI
  if (heroCardVisible === true || committeeSectionVisible === true) {
    const committeeCount = await prisma.committee.count();
    if (committeeCount === 0) {
      if (heroCardVisible === true) {
        return res.status(400).json({ error: 'ยังไม่มีข้อมูลทำเนียบประธานค่าย เพิ่มข้อมูลก่อนถึงจะเปิดแสดงการ์ดเด่นได้' });
      }
      return res.status(400).json({ error: 'ยังไม่มีข้อมูลทำเนียบประธานค่าย เพิ่มข้อมูลก่อนถึงจะเปิดแสดงส่วนนี้ได้' });
    }
  }
  if (newsSectionVisible === true) {
    const newsCount = await prisma.news.count({ where: { isVisible: true } });
    if (newsCount === 0) {
      return res.status(400).json({ error: 'ยังไม่มีข่าวที่แสดงอยู่ เพิ่มข่าวก่อนถึงจะเปิดแสดงส่วนนี้ได้' });
    }
  }
  if (participantRegistrationOpen === true) {
    // ต้องมีค่ายที่ "กำลังดำเนินการ" จริง (ยังไม่จบ) ไม่ใช่แค่เคยมีค่ายมาก่อน เปิดไม่ได้เลยถ้าค่ายล่าสุดจบไปแล้วหรือยังไม่เคยสร้างค่าย
    const campState = await getCampState(prisma);
    if (!campState.isActive) {
      return res.status(400).json({ error: 'ยังไม่มีค่ายที่กำลังดำเนินการ สร้างค่ายใหม่ก่อนถึงจะเปิดรับลงทะเบียนน้องค่ายได้' });
    }
  }

  const data = {
    ...(heroCardVisible !== undefined && { heroCardVisible: Boolean(heroCardVisible) }),
    ...(staffRegistrationOpen !== undefined && { staffRegistrationOpen: Boolean(staffRegistrationOpen) }),
    ...(participantRegistrationOpen !== undefined && { participantRegistrationOpen: Boolean(participantRegistrationOpen) }),
    ...(staffAutoApprove !== undefined && { staffAutoApprove: Boolean(staffAutoApprove) }),
    ...(participantAutoApprove !== undefined && { participantAutoApprove: Boolean(participantAutoApprove) }),
    ...(newsAutoApprove !== undefined && { newsAutoApprove: Boolean(newsAutoApprove) }),
    ...(checkRegistrationVisibleStaff !== undefined && { checkRegistrationVisibleStaff: Boolean(checkRegistrationVisibleStaff) }),
    ...(checkRegistrationVisibleParticipant !== undefined && { checkRegistrationVisibleParticipant: Boolean(checkRegistrationVisibleParticipant) }),
    ...(committeeSectionVisible !== undefined && { committeeSectionVisible: Boolean(committeeSectionVisible) }),
    ...(newsSectionVisible !== undefined && { newsSectionVisible: Boolean(newsSectionVisible) }),
    ...(historyTitle !== undefined && { historyTitle: historyTitle || null }),
    ...(historyBody !== undefined && { historyBody: historyBody || null }),
  };

  const settings = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  invalidateSiteSettingsCache();

  const changeSummaries = [
    ...(heroCardVisible !== undefined ? [`การ์ดเด่นประธานค่ายใน Hero: ${settings.heroCardVisible ? 'แสดง' : 'ซ่อน'}`] : []),
    ...(staffRegistrationOpen !== undefined ? [`ลงทะเบียนพี่ค่าย: ${settings.staffRegistrationOpen ? 'เปิด' : 'ปิด'}`] : []),
    ...(participantRegistrationOpen !== undefined ? [`ลงทะเบียนน้องค่าย: ${settings.participantRegistrationOpen ? 'เปิด' : 'ปิด'}`] : []),
    ...(staffAutoApprove !== undefined ? [`อนุมัติอัตโนมัติพี่ค่าย: ${settings.staffAutoApprove ? 'เปิด' : 'ปิด'}`] : []),
    ...(participantAutoApprove !== undefined ? [`อนุมัติอัตโนมัติน้องค่าย: ${settings.participantAutoApprove ? 'เปิด' : 'ปิด'}`] : []),
    ...(newsAutoApprove !== undefined ? [`อนุมัติอัตโนมัติประชาสัมพันธ์: ${settings.newsAutoApprove ? 'เปิด' : 'ปิด'}`] : []),
    ...(checkRegistrationVisibleStaff !== undefined ? [`ตรวจสอบผลการลงทะเบียน (พี่ค่าย): ${settings.checkRegistrationVisibleStaff ? 'แสดง' : 'ซ่อน'}`] : []),
    ...(checkRegistrationVisibleParticipant !== undefined ? [`ตรวจสอบผลการลงทะเบียน (น้องค่าย): ${settings.checkRegistrationVisibleParticipant ? 'แสดง' : 'ซ่อน'}`] : []),
    ...(committeeSectionVisible !== undefined ? [`ส่วนทำเนียบประธานค่ายในหน้าแรก: ${settings.committeeSectionVisible ? 'แสดง' : 'ซ่อน'}`] : []),
    ...(newsSectionVisible !== undefined ? [`ส่วนข่าวสารล่าสุดในหน้าแรก: ${settings.newsSectionVisible ? 'แสดง' : 'ซ่อน'}`] : []),
    ...(historyTitle !== undefined || historyBody !== undefined ? ['แก้ไขข้อความ "ความเป็นมา" ของค่าย'] : []),
  ];
  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'SITE_SETTING',
    entityId: settings.id,
    summary: `แก้ไขการตั้งค่าเว็บไซต์ (${changeSummaries.join(', ') || 'ไม่มีการเปลี่ยนแปลง'})`,
  });

  res.json(settings);
}

module.exports = { getSiteSettings, updateSiteSettings };
