const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { isAcademicManager } = require('../middleware/requireAuth');
const { ensureGradeBands, resolveGrade } = require('../lib/gradeBands');
const { ensureScoreWeightSetting } = require('../lib/scoreWeightSetting');
const { buildParticipantCode } = require('../lib/camp');
const { resolveParticipantWhere } = require('../lib/participantSimulation');

const PARTICIPANT_SELECT = { id: true, prefix: true, firstName: true, lastName: true, nickname: true, courseFormatId: true, campGenerationNo: true };
// เฉพาะวิชาที่ต้องเก็บคะแนน (requiresScoring) เท่านั้นที่เข้าสูตรคำนวณ/มีช่องกรอกคะแนน วิชาที่ไม่เก็บคะแนนจะไม่ถูกดึงมาเลย
const SCORED_SUBJECT_WHERE = { requiresScoring: true };

// คำนำหน้าชื่อติดกับชื่อจริงไม่มีเว้นวรรค ตามธรรมเนียมการเขียนชื่อภาษาไทย เช่น "นายวิชัย ตั้งใจ" ไม่ใช่ "นาย วิชัย ตั้งใจ"
function toFullName(profile) {
  const prefixedFirstName = `${profile.prefix || ''}${profile.firstName || ''}`;
  return [prefixedFirstName, profile.lastName].filter(Boolean).join(' ') || '-';
}

// คะแนนภาพรวม (0-100) = ผลรวมคะแนนที่แต่ละวิชาที่เก็บคะแนน "แบ่ง" มาจากสัดส่วนกลาง
// สัดส่วนคะแนนอธิบาย:คะแนนสอบ (เช่น 70:30) เป็นค่ากลางไม่ได้ตั้งแยกรายวิชา (globalWeights มาจาก ScoreWeightSetting)
// วิชาที่เก็บคะแนนแต่ละวิชาได้ "ส่วนแบ่ง" ของสัดส่วนกลางตาม credits เทียบกับผลรวม credits ของวิชาที่เก็บคะแนนทั้งหมด
// เช่น อธิบาย 70% หาร 5 วิชาหน่วยกิตเท่ากัน = 14% ต่อวิชา, ถ้าหน่วยกิตไม่เท่ากันวิชาหน่วยกิตเยอะได้ส่วนแบ่งมากกว่า
// คะแนนดิบที่กรอก (เช่น สอบได้ 38 จากเต็ม 50) แปลงเป็นสัดส่วนด้วยคะแนนเต็มของวิชานั้น (explanationMaxScore/achievementMaxScore) ก่อนคูณส่วนแบ่งข้างต้น
// subjects ที่ส่งเข้ามาต้องกรองเหลือเฉพาะ requiresScoring แล้ว (ดู SCORED_SUBJECT_WHERE) ฟังก์ชันนี้ไม่กรองซ้ำ
// bands มาจาก GradeBand ปรับได้ที่แท็บ "จัดการคะแนน" - ช่วงคะแนนที่กำหนดเองได้ ครอบคลุม 0-100 ครบเสมอ (colorKey ติดมากับแต่ละช่วงอยู่แล้ว)
// ใช้ร่วมกันทั้งฝั่ง roster (พี่ค่ายดูทั้งคอร์ส) และฝั่ง me (น้องค่ายดูของตัวเอง) กันสูตรเพี้ยนไม่ตรงกัน
function computeSubjectScoreSummary(subjects, scoreBySubjectId, bands, globalWeights) {
  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);

  const perSubject = subjects.map((s) => {
    const score = scoreBySubjectId.get(s.id);
    const explanationScore = score?.explanationScore ?? 0;
    const achievementScore = score?.achievementScore ?? 0;
    const creditShare = totalCredits ? s.credits / totalCredits : 0;
    const explanationQuota = globalWeights.explanationWeight * creditShare;
    const achievementQuota = globalWeights.achievementWeight * creditShare;
    const explanationPart = (explanationScore / s.explanationMaxScore) * explanationQuota;
    const achievementPart = (achievementScore / s.achievementMaxScore) * achievementQuota;
    const subjectScore = Math.round((explanationPart + achievementPart) * 100) / 100;
    return { subjectId: s.id, subjectScore };
  });

  const grandTotal = Math.round(perSubject.reduce((sum, p) => sum + p.subjectScore, 0) * 100) / 100;

  const { grade, gradeColorKey } = resolveGrade(grandTotal, bands);

  return { perSubject, grandTotal, grade, gradeColorKey };
}

// รายชื่อน้องค่ายในคอร์สที่ระบุ พร้อมคะแนนทุกวิชาและค่าที่คำนวณแล้ว (ไม่รวมอีเมล/เบอร์โทร เหมือน /api/groups)
// ผู้สอนที่ไม่ใช่ manager เห็นเฉพาะคอลัมน์วิชา/คะแนนของวิชาที่ตัวเองรับผิดชอบเท่านั้น (ไม่ส่งคะแนนวิชาอื่นออกไปทาง network เลย ไม่ใช่แค่ปิดช่องกรอกฝั่ง frontend)
// ส่วน "viewer" (staff ที่ไม่ได้สอนวิชาไหนเลย ไม่ใช่ manager) ยังเห็นภาพรวมทั้งคอร์สแบบอ่านอย่างเดียวเหมือนเดิม เพราะไม่มีวิชาของตัวเองให้กรองอยู่แล้ว
async function getRoster(req, res) {
  const courseFormatId = Number(req.query.courseFormatId);
  if (!courseFormatId) return res.status(400).json({ error: 'ต้องระบุ courseFormatId' });
  // scope=full มาจากแท็บ "ตารางคะแนน" (อ่านอย่างเดียว ดูภาพรวมทั้งคอร์สได้ทุกคน) ต่างจากแท็บ "จัดการรายวิชาของตัวเอง" ที่ไม่ส่ง scope มา (ผู้สอนถูกกรองเหลือแค่วิชาตัวเองเพื่อกรอกคะแนน)
  // ผู้สอนที่ขอ scope=full ให้มองเป็นเหมือน viewer สำหรับ request นี้ครั้งเดียว (เห็นทุกวิชาทุกคอร์ส แต่แก้ไขไม่ได้อยู่แล้วฝั่ง frontend เพราะเป็น instructor ไม่ใช่ manager)
  const fullScope = req.query.scope === 'full';

  const prisma = await getPrisma();
  const manager = isAcademicManager(req.session.user);
  const [profiles, allSubjects, bands, globalWeights, courseFormat, myAssignments] = await Promise.all([
    prisma.participantProfile.findMany({
      where: { courseFormatId },
      select: {
        ...PARTICIPANT_SELECT,
        subjectScores: { select: { subjectId: true, explanationScore: true, achievementScore: true } },
      },
      orderBy: { firstName: 'asc' },
    }),
    // courseFormatId: null บนวิชา = "ทั้งคู่" (ใช้ร่วมกันทุกคอร์ส) ต้องรวมมาด้วยเสมอไม่ว่าจะดูคอร์สไหนอยู่
    prisma.subject.findMany({ where: { ...SCORED_SUBJECT_WHERE, OR: [{ courseFormatId }, { courseFormatId: null }] }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    ensureGradeBands(prisma),
    ensureScoreWeightSetting(prisma),
    prisma.courseFormat.findUnique({ where: { id: courseFormatId }, select: { name: true } }),
    manager ? Promise.resolve([]) : prisma.subjectInstructor.findMany({ where: { userId: req.session.user.id }, select: { subject: { select: { id: true, courseFormatId: true } } } }),
  ]);

  // ผู้สอนจริง (ไม่ใช่ manager และมีวิชาที่รับผิดชอบอยู่อย่างน้อย 1 วิชา) ต้องดูคอร์สที่ตัวเองสอนอยู่เท่านั้น (หรือวิชาที่ courseFormatId: null ใช้ร่วมทุกคอร์ส) - ยกเว้น scope=full ที่เปิดให้ดูได้ทุกคอร์สแบบ viewer
  const myAssignedSubjectIds = new Set(myAssignments.map((a) => a.subject.id));
  if (!fullScope && !manager && myAssignedSubjectIds.size > 0) {
    const teachesThisCourse = myAssignments.some((a) => a.subject.courseFormatId === courseFormatId || a.subject.courseFormatId === null);
    if (!teachesThisCourse) return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูตารางคะแนนคอร์สนี้ (ไม่ได้สอนวิชาในคอร์สนี้)' });
  }
  // manager, viewer (ไม่ได้สอนวิชาไหนเลย) และคำขอ scope=full เห็นทุกวิชาเหมือนกัน - ผู้สอนจริงที่ไม่ได้ขอ scope=full เห็นแค่วิชาที่ตัวเองรับผิดชอบ (ไปกรอกคะแนนที่ "จัดการรายวิชาของตัวเอง")
  const visibleSubjects = (!fullScope && !manager && myAssignedSubjectIds.size > 0)
    ? allSubjects.filter((s) => myAssignedSubjectIds.has(s.id))
    : allSubjects;

  const roster = profiles.map((p) => {
    const scoreBySubjectId = new Map(p.subjectScores.map((s) => [s.subjectId, s]));
    // grandTotal/grade คำนวณจาก allSubjects เสมอ (สะท้อนคะแนนรวมจริงทั้งคอร์ส) แม้จะโชว์คอลัมน์วิชาบางส่วนก็ตาม
    const summary = computeSubjectScoreSummary(allSubjects, scoreBySubjectId, bands, globalWeights);
    return {
      id: p.id,
      // ใช้ campGenerationNo ที่ประทับไว้ ณ ตอนคนนี้ลงทะเบียนจริง (ไม่ใช่ค่ายรุ่นปัจจุบันที่อาจเปลี่ยนไปแล้ว) กันรหัสขยับเองถ้ามีการเปิดค่ายรุ่นถัดไป
      code: buildParticipantCode(p.campGenerationNo ?? 1, courseFormat?.name, p.id),
      fullName: toFullName(p),
      nickname: p.nickname,
      scores: visibleSubjects.map((s) => ({
        subjectId: s.id,
        explanationScore: scoreBySubjectId.get(s.id)?.explanationScore ?? null,
        achievementScore: scoreBySubjectId.get(s.id)?.achievementScore ?? null,
      })),
      summary,
    };
  });

  // totalCredits คำนวณจาก allSubjects เสมอ (ไม่ใช่ visibleSubjects) ให้ frontend ใช้คิดสัดส่วน % ของแต่ละวิชาตรงกับคะแนนรวมจริงที่ manager เห็น
  // แม้ผู้สอนจะเห็นวิชาตัวเองไม่ครบทุกวิชาก็ตาม (ไม่งั้นสัดส่วนที่โชว์จะพองเกินจริงเพราะฐานหน่วยกิตแคบกว่าความเป็นจริง)
  const totalCredits = allSubjects.reduce((sum, s) => sum + s.credits, 0);

  res.json({ subjects: visibleSubjects, roster, totalCredits });
}

// บันทึกคะแนนทุกวิชาของน้องค่าย 1 คนในครั้งเดียว body: { scores: [{ subjectId, explanationScore, achievementScore }] }
// ผู้สอนที่ไม่ใช่ manager แก้ได้เฉพาะวิชาที่ตัวเองสอน - รายการวิชาอื่นที่แนบมาด้วย (จากช่องที่ frontend disable ไว้) จะถูกเพิกเฉยเงียบ ๆ
// ไม่ error เพราะค่าที่ส่งมาคือค่าเดิมที่ไม่ได้เปลี่ยน ไม่ใช่ความพยายามแก้ไขจริง
async function saveParticipantScores(req, res) {
  const participantProfileId = Number(req.params.participantProfileId);
  let scores = Array.isArray(req.body.scores) ? req.body.scores : [];
  const manager = isAcademicManager(req.session.user);

  const prisma = await getPrisma();
  const [profile, subjects] = await Promise.all([
    prisma.participantProfile.findUnique({ where: { id: participantProfileId }, select: PARTICIPANT_SELECT }),
    prisma.subject.findMany(),
  ]);
  if (!profile) return res.status(404).json({ error: 'ไม่พบน้องค่าย' });

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  // วิชาที่ไม่ต้องเก็บคะแนน (requiresScoring: false) ไม่มีช่องกรอกให้กรอกอยู่แล้วฝั่ง frontend - กันไว้อีกชั้นเผื่อมีค่าเก่าติดมาด้วย
  // เช่นเดียวกับวิชาที่อยู่คนละคอร์สกับตัวน้องค่ายคนนี้ (ตารางคะแนนฝั่ง frontend กรองแยกคอร์สอยู่แล้ว กันไว้อีกชั้นเผื่อมีค่าเก่าติดมาหรือแก้ query ผิด)
  scores = scores.filter((entry) => {
    const subject = subjectById.get(Number(entry.subjectId));
    return subject?.requiresScoring && (subject.courseFormatId === profile.courseFormatId || subject.courseFormatId === null);
  });

  if (!manager) {
    const mySubjects = await prisma.subject.findMany({ where: { instructors: { some: { userId: req.session.user.id } } }, select: { id: true } });
    const mySubjectIds = new Set(mySubjects.map((s) => s.id));
    scores = scores.filter((entry) => mySubjectIds.has(Number(entry.subjectId)));
  }

  for (const entry of scores) {
    const subjectId = Number(entry.subjectId);
    const subject = subjectById.get(subjectId);

    const explanationScore = entry.explanationScore === null || entry.explanationScore === undefined || entry.explanationScore === ''
      ? null : Number(entry.explanationScore);
    const achievementScore = entry.achievementScore === null || entry.achievementScore === undefined || entry.achievementScore === ''
      ? null : Number(entry.achievementScore);

    if (explanationScore !== null && (!Number.isInteger(explanationScore) || explanationScore < 0 || explanationScore > subject.explanationMaxScore)) {
      return res.status(400).json({ error: `คะแนนอธิบายวิชา "${subject.name}" ต้องอยู่ระหว่าง 0-${subject.explanationMaxScore}` });
    }
    if (achievementScore !== null && (!Number.isInteger(achievementScore) || achievementScore < 0 || achievementScore > subject.achievementMaxScore)) {
      return res.status(400).json({ error: `คะแนนสอบวิชา "${subject.name}" ต้องอยู่ระหว่าง 0-${subject.achievementMaxScore}` });
    }
  }

  await Promise.all(scores.map((entry) => {
    const subjectId = Number(entry.subjectId);
    const explanationScore = entry.explanationScore === null || entry.explanationScore === undefined || entry.explanationScore === ''
      ? null : Number(entry.explanationScore);
    const achievementScore = entry.achievementScore === null || entry.achievementScore === undefined || entry.achievementScore === ''
      ? null : Number(entry.achievementScore);

    return prisma.participantSubjectScore.upsert({
      where: { participantProfileId_subjectId: { participantProfileId, subjectId } },
      create: { participantProfileId, subjectId, explanationScore, achievementScore },
      update: { explanationScore, achievementScore },
    });
  }));

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'PARTICIPANT_SUBJECT_SCORE',
    entityId: participantProfileId,
    summary: `บันทึกคะแนนวิชาการของ "${toFullName(profile)}"`,
  });

  res.status(204).end();
}

// คะแนนของตัวเอง (ฝั่งน้องค่าย) - WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere)
async function getMyScores(req, res) {
  const prisma = await getPrisma();
  const profile = await prisma.participantProfile.findUnique({
    where: resolveParticipantWhere(req) || { userId: -1 },
    select: {
      courseFormatId: true,
      subjectScores: { select: { subjectId: true, explanationScore: true, achievementScore: true } },
    },
  });

  const [subjects, bands, globalWeights] = await Promise.all([
    // courseFormatId: null บนวิชา = "ทั้งคู่" ต้องรวมมาด้วยเสมอเหมือน getRoster
    prisma.subject.findMany({ where: { ...SCORED_SUBJECT_WHERE, OR: [{ courseFormatId: profile?.courseFormatId }, { courseFormatId: null }] }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    ensureGradeBands(prisma),
    ensureScoreWeightSetting(prisma),
  ]);

  const scoreBySubjectId = new Map((profile?.subjectScores || []).map((s) => [s.subjectId, s]));
  const summary = computeSubjectScoreSummary(subjects, scoreBySubjectId, bands, globalWeights);
  const subjectScores = subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    explanationScore: scoreBySubjectId.get(s.id)?.explanationScore ?? null,
    explanationMaxScore: s.explanationMaxScore,
    achievementScore: scoreBySubjectId.get(s.id)?.achievementScore ?? null,
    achievementMaxScore: s.achievementMaxScore,
  }));

  res.json({ subjectScores, summary });
}

module.exports = {
  getRoster,
  saveParticipantScores,
  getMyScores,
};
