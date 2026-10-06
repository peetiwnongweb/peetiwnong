const QRCode = require('qrcode');
const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { isAcademicManager } = require('../middleware/requireAuth');
const { buildParticipantCode } = require('../lib/camp');
// ใช้ไฟล์ตัวตรวจเดียวกับหน้าเว็บ (UMD) - เลย์เอาต์และการให้คะแนนฝั่งเซิร์ฟเวอร์ตรงกับที่หน้าสแกนเห็นเสมอ
const Omr = require('../../fontend/public/js/omr/omr-engine');

const CHOICE_STYLES = ['thai', 'latin', 'number'];
const MAX_SECTIONS = 6;

function toFullName(profile) {
  const prefixedFirstName = `${profile.prefix || ''}${profile.firstName || ''}`;
  return [prefixedFirstName, profile.lastName].filter(Boolean).join(' ') || '-';
}

// วิชาที่ผู้ใช้คนนี้เป็นผู้สอน (ผู้สอนสแกน/ใส่เฉลยได้เฉพาะชุดข้อสอบที่มีวิชาของตัวเอง)
async function myInstructorSubjectIds(prisma, user) {
  if (isAcademicManager(user)) return null;
  const rows = await prisma.subjectInstructor.findMany({ where: { userId: user.id }, select: { subjectId: true } });
  return new Set(rows.map((r) => r.subjectId));
}

function canAccessExam(user, exam, mySubjectIds) {
  if (isAcademicManager(user)) return true;
  return (exam.sections || []).some((s) => mySubjectIds && mySubjectIds.has(s.subjectId));
}

async function loadExam(prisma, req, res) {
  const exam = await prisma.achievementExam.findUnique({ where: { id: Number(req.params.id) } });
  if (!exam) { res.status(404).json({ error: 'ไม่พบชุดข้อสอบนี้' }); return null; }
  const mySubjectIds = await myInstructorSubjectIds(prisma, req.session.user);
  if (!canAccessExam(req.session.user, exam, mySubjectIds)) { res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงชุดข้อสอบนี้' }); return null; }
  return { exam, mySubjectIds };
}

async function decorateSections(prisma, sections) {
  const subjects = await prisma.subject.findMany({ where: { id: { in: sections.map((s) => s.subjectId) } }, select: { id: true, name: true, achievementMaxScore: true } });
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return sections.map((s) => ({ ...s, title: byId.get(s.subjectId)?.name || 'วิชาที่ถูกลบ', achievementMaxScore: byId.get(s.subjectId)?.achievementMaxScore ?? null }));
}

async function serializeExam(prisma, exam, extra = {}) {
  const course = await prisma.courseFormat.findUnique({ where: { id: exam.courseFormatId }, select: { name: true } });
  return {
    id: exam.id,
    title: exam.title,
    courseFormatId: exam.courseFormatId,
    courseName: course?.name || '',
    choiceCount: exam.choiceCount,
    choiceStyle: exam.choiceStyle,
    sections: await decorateSections(prisma, exam.sections),
    answerKey: exam.answerKey,
    isPublished: exam.isPublished,
    publishedAt: exam.publishedAt,
    createdAt: exam.createdAt,
    ...extra,
  };
}

// ตรวจและปรับรูปแบบ sections ที่ส่งมา - คืน { sections } หรือ { error }
async function validateSections(prisma, rawSections, courseFormatId, choiceCount, choiceStyle) {
  if (!Array.isArray(rawSections) || !rawSections.length) return { error: 'ต้องมีอย่างน้อย 1 ตอน (รายวิชา)' };
  if (rawSections.length > MAX_SECTIONS) return { error: `แบ่งได้ไม่เกิน ${MAX_SECTIONS} ตอน` };
  const sections = rawSections.map((s) => ({
    subjectId: Number(s.subjectId),
    questionCount: Number(s.questionCount),
    pointsPerQuestion: Number(s.pointsPerQuestion) || 1,
  }));
  if (new Set(sections.map((s) => s.subjectId)).size !== sections.length) return { error: 'มีรายวิชาซ้ำกันในชุดข้อสอบ' };
  for (const s of sections) {
    if (!Number.isInteger(s.questionCount) || s.questionCount < 1) return { error: 'จำนวนข้อของแต่ละตอนต้องเป็นจำนวนเต็มอย่างน้อย 1' };
    if (!(s.pointsPerQuestion > 0) || s.pointsPerQuestion > 100) return { error: 'คะแนนต่อข้อต้องมากกว่า 0' };
  }
  const subjects = await prisma.subject.findMany({ where: { id: { in: sections.map((s) => s.subjectId) } } });
  if (subjects.length !== sections.length) return { error: 'ไม่พบบางรายวิชา' };
  for (const subject of subjects) {
    if (!subject.requiresScoring) return { error: `วิชา "${subject.name}" ไม่ได้เก็บคะแนน` };
    if (subject.courseFormatId !== null && subject.courseFormatId !== courseFormatId) return { error: `วิชา "${subject.name}" ไม่ได้อยู่ในคอร์สนี้` };
  }
  const total = sections.reduce((sum, s) => sum + s.questionCount, 0);
  if (total > Omr.MAX_QUESTIONS) return { error: `รวมทุกตอนได้ไม่เกิน ${Omr.MAX_QUESTIONS} ข้อ` };
  const layout = Omr.computeLayout({ choiceCount, choiceStyle, sections: sections.map((s) => ({ ...s, title: '' })) });
  if (layout.overflow) return { error: 'จำนวนข้อและตอนเกินพื้นที่กระดาษ 1 แผ่น ลองลดจำนวนตอนหรือจำนวนข้อ' };
  return { sections, total };
}

function resizeKey(key, total) {
  const out = Array.isArray(key) ? key.slice(0, total) : [];
  while (out.length < total) out.push([]);
  return out;
}

function validateAnswers(answers, total, choiceCount) {
  if (!Array.isArray(answers) || answers.length !== total) return false;
  return answers.every((a) => Array.isArray(a) && a.every((c) => Number.isInteger(c) && c >= 0 && c < choiceCount));
}

function gradeSubmission(exam, answers) {
  const result = Omr.grade({ sections: exam.sections, answerKey: exam.answerKey }, answers);
  return { sectionScores: result.sections, totalPoints: result.totalPoints };
}

// เขียน "คะแนนสอบ" ลงตารางคะแนนของแต่ละวิชาตามสัดส่วนคะแนนเต็มของวิชานั้น (เรียกตอนประกาศผล และทุกครั้งที่มีการเปลี่ยนหลังประกาศแล้ว)
async function syncScores(tx, exam, submissions) {
  const subjects = await tx.subject.findMany({ where: { id: { in: exam.sections.map((s) => s.subjectId) } }, select: { id: true, achievementMaxScore: true } });
  const maxById = new Map(subjects.map((s) => [s.id, s.achievementMaxScore]));
  for (const sub of submissions) {
    for (const sec of sub.sectionScores) {
      const max = maxById.get(sec.subjectId);
      if (!max || !sec.maxPoints) continue;
      const achievementScore = Math.round((sec.points / sec.maxPoints) * max);
      await tx.participantSubjectScore.upsert({
        where: { participantProfileId_subjectId: { participantProfileId: sub.participantProfileId, subjectId: sec.subjectId } },
        create: { participantProfileId: sub.participantProfileId, subjectId: sec.subjectId, achievementScore },
        update: { achievementScore },
      });
    }
  }
}

function log(req, action, entityId, summary, entityType = 'ACHIEVEMENT_EXAM') {
  return logActivity({ actorEmail: req.session.user.email, actorRole: req.session.user.role, action, entityType, entityId, summary });
}

// ==========================================
async function listExams(req, res) {
  const prisma = await getPrisma();
  const mySubjectIds = await myInstructorSubjectIds(prisma, req.session.user);
  const exams = await prisma.achievementExam.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { submissions: true } } } });
  const visible = exams.filter((e) => canAccessExam(req.session.user, e, mySubjectIds));
  const out = [];
  for (const exam of visible) {
    const participantCount = await prisma.participantProfile.count({ where: { courseFormatId: exam.courseFormatId, user: { approvalStatus: 'APPROVED' } } });
    out.push(await serializeExam(prisma, exam, { submissionCount: exam._count.submissions, participantCount }));
  }
  res.json({ exams: out, canManage: isAcademicManager(req.session.user) });
}

async function createExam(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'สร้างชุดข้อสอบได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const title = String(req.body.title || '').trim();
  const courseFormatId = Number(req.body.courseFormatId);
  const choiceCount = Number(req.body.choiceCount) === 5 ? 5 : 4;
  const choiceStyle = CHOICE_STYLES.includes(req.body.choiceStyle) ? req.body.choiceStyle : 'thai';
  if (!title) return res.status(400).json({ error: 'ต้องระบุชื่อชุดข้อสอบ' });
  const prisma = await getPrisma();
  if (!courseFormatId || !(await prisma.courseFormat.findUnique({ where: { id: courseFormatId } }))) return res.status(400).json({ error: 'คอร์สไม่ถูกต้อง' });
  const v = await validateSections(prisma, req.body.sections, courseFormatId, choiceCount, choiceStyle);
  if (v.error) return res.status(400).json({ error: v.error });
  const exam = await prisma.achievementExam.create({
    data: { title, courseFormatId, choiceCount, choiceStyle, sections: v.sections, answerKey: resizeKey([], v.total), createdByUserId: req.session.user.id },
  });
  await log(req, 'CREATE', exam.id, `สร้างชุดข้อสอบวัดผล "${title}" (${v.total} ข้อ)`);
  res.status(201).json(await serializeExam(prisma, exam, { submissionCount: 0 }));
}

// แก้ชุดข้อสอบ: ถ้ามีผลสแกนแล้ว แก้ได้แค่ชื่อและคะแนนต่อข้อ (เปลี่ยนจำนวนข้อ/ตัวเลือก/ลำดับตอนจะทำให้กระดาษที่สแกนไปแล้วอ่านผิด)
async function updateExam(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'แก้ชุดข้อสอบได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const { exam } = loaded;
  const submissionCount = await prisma.achievementExamSubmission.count({ where: { examId: exam.id } });
  const title = req.body.title !== undefined ? String(req.body.title).trim() : exam.title;
  if (!title) return res.status(400).json({ error: 'ต้องระบุชื่อชุดข้อสอบ' });
  const choiceCount = req.body.choiceCount !== undefined ? (Number(req.body.choiceCount) === 5 ? 5 : 4) : exam.choiceCount;
  const choiceStyle = CHOICE_STYLES.includes(req.body.choiceStyle) ? req.body.choiceStyle : exam.choiceStyle;
  const v = await validateSections(prisma, req.body.sections || exam.sections, exam.courseFormatId, choiceCount, choiceStyle);
  if (v.error) return res.status(400).json({ error: v.error });
  if (submissionCount) {
    const sameShape = choiceCount === exam.choiceCount && v.sections.length === exam.sections.length
      && v.sections.every((s, i) => s.subjectId === exam.sections[i].subjectId && s.questionCount === exam.sections[i].questionCount);
    if (!sameShape) return res.status(409).json({ error: 'สแกนกระดาษไปแล้ว เปลี่ยนจำนวนข้อ/ตัวเลือก/ลำดับวิชาไม่ได้ (แก้ได้แค่ชื่อ คะแนนต่อข้อ และเฉลย)' });
  }
  const updated = await prisma.achievementExam.update({
    where: { id: exam.id },
    data: { title, choiceCount, choiceStyle, sections: v.sections, answerKey: resizeKey(exam.answerKey, v.total) },
  });
  await regradeAll(prisma, updated);
  await log(req, 'UPDATE', exam.id, `แก้ไขชุดข้อสอบวัดผล "${title}"`);
  res.json(await serializeExam(prisma, updated, { submissionCount }));
}

async function regradeAll(prisma, exam) {
  const subs = await prisma.achievementExamSubmission.findMany({ where: { examId: exam.id } });
  await prisma.$transaction(async (tx) => {
    const regraded = [];
    for (const sub of subs) {
      const g = gradeSubmission(exam, sub.answers);
      await tx.achievementExamSubmission.update({ where: { id: sub.id }, data: g });
      regraded.push({ participantProfileId: sub.participantProfileId, sectionScores: g.sectionScores });
    }
    if (exam.isPublished) await syncScores(tx, exam, regraded);
  }, { timeout: 30000 });
}

// เฉลย: ผู้บริหาร/หัวหน้าฝ่ายแก้ได้ทุกข้อ ผู้สอนแก้ได้เฉพาะข้อในตอนวิชาที่ตัวเองสอน - เปลี่ยนเฉลยแล้วตรวจใหม่ทุกแผ่นทันที
async function updateAnswerKey(req, res) {
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const { exam, mySubjectIds } = loaded;
  const total = exam.sections.reduce((sum, s) => sum + s.questionCount, 0);
  const key = req.body.answerKey;
  if (!Array.isArray(key) || key.length !== total) return res.status(400).json({ error: 'เฉลยไม่ครบตามจำนวนข้อ' });
  const valid = key.every((k) => k === '*' || (Array.isArray(k) && k.every((c) => Number.isInteger(c) && c >= 0 && c < exam.choiceCount)));
  if (!valid) return res.status(400).json({ error: 'เฉลยไม่ถูกต้อง' });
  if (mySubjectIds) {
    let q = 0;
    for (const section of exam.sections) {
      for (let i = 0; i < section.questionCount; i++, q++) {
        if (!mySubjectIds.has(section.subjectId) && JSON.stringify(key[q]) !== JSON.stringify(exam.answerKey[q] ?? [])) {
          return res.status(403).json({ error: 'แก้เฉลยได้เฉพาะตอนของวิชาที่ตัวเองสอน' });
        }
      }
    }
  }
  const normalized = key.map((k) => (k === '*' ? '*' : [...new Set(k)].sort()));
  const updated = await prisma.achievementExam.update({ where: { id: exam.id }, data: { answerKey: normalized } });
  await regradeAll(prisma, updated);
  await log(req, 'UPDATE', exam.id, `บันทึกเฉลยชุดข้อสอบวัดผล "${exam.title}"`);
  res.json(await serializeExam(prisma, updated));
}

async function deleteExam(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'ลบชุดข้อสอบได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  await prisma.achievementExam.delete({ where: { id: loaded.exam.id } });
  await log(req, 'DELETE', loaded.exam.id, `ลบชุดข้อสอบวัดผล "${loaded.exam.title}"`);
  res.status(204).end();
}

// รายชื่อน้องค่ายของคอร์สพร้อม QR (SVG) สำหรับพิมพ์กระดาษรายคน และใช้จับคู่ตอนสแกน (QR / รหัสที่ฝน)
async function getRoster(req, res) {
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const { exam } = loaded;
  const [profiles, submitted] = await Promise.all([
    prisma.participantProfile.findMany({
      where: { courseFormatId: exam.courseFormatId, user: { approvalStatus: 'APPROVED' } },
      orderBy: { firstName: 'asc' },
      select: { id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true, courseFormat: { select: { name: true } } },
    }),
    prisma.achievementExamSubmission.findMany({ where: { examId: exam.id }, select: { participantProfileId: true } }),
  ]);
  const submittedIds = new Set(submitted.map((s) => s.participantProfileId));
  const withQr = req.query.qr === '1';
  const qr = (text) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const participants = [];
  for (const p of profiles) {
    participants.push({
      id: p.id,
      code: buildParticipantCode(p.campGenerationNo ?? 1, p.courseFormat?.name, p.id),
      fullName: toFullName(p),
      nickname: p.nickname,
      course: p.courseFormat?.name || '',
      submitted: submittedIds.has(p.id),
      ...(withQr && { qrSvg: await qr(`PTN-EX:${exam.id}:${p.id}`) }),
    });
  }
  res.json({ participants, ...(withQr && { blankQrSvg: await qr(`PTN-EX:${exam.id}:0`) }) });
}

async function listSubmissions(req, res) {
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const subs = await prisma.achievementExamSubmission.findMany({
    where: { examId: loaded.exam.id },
    orderBy: { updatedAt: 'desc' },
    include: { participantProfile: { select: { id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true, courseFormat: { select: { name: true } } } } },
  });
  res.json({
    submissions: subs.map((s) => ({
      participantProfileId: s.participantProfileId,
      code: buildParticipantCode(s.participantProfile.campGenerationNo ?? 1, s.participantProfile.courseFormat?.name, s.participantProfile.id),
      fullName: toFullName(s.participantProfile),
      nickname: s.participantProfile.nickname,
      answers: s.answers,
      sectionScores: s.sectionScores,
      totalPoints: s.totalPoints,
      source: s.source,
      updatedAt: s.updatedAt,
    })),
  });
}

// บันทึกผลสแกน (หรือกรอกเอง) ของน้อง 1 คน - ตรวจคะแนนฝั่งเซิร์ฟเวอร์ใหม่ด้วยเฉลยปัจจุบันเสมอ ไม่เชื่อคะแนนจากหน้าเว็บ
async function saveSubmission(req, res) {
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const { exam } = loaded;
  const participantProfileId = Number(req.params.participantProfileId);
  const profile = await prisma.participantProfile.findUnique({ where: { id: participantProfileId }, select: { id: true, courseFormatId: true, prefix: true, firstName: true, lastName: true } });
  if (!profile) return res.status(404).json({ error: 'ไม่พบน้องค่าย' });
  if (profile.courseFormatId !== exam.courseFormatId) return res.status(400).json({ error: 'น้องค่ายคนนี้ไม่ได้อยู่ในคอร์สของชุดข้อสอบนี้' });
  const total = exam.sections.reduce((sum, s) => sum + s.questionCount, 0);
  if (!validateAnswers(req.body.answers, total, exam.choiceCount)) return res.status(400).json({ error: 'คำตอบไม่ครบหรือไม่ถูกต้อง' });
  const source = req.body.source === 'manual' ? 'manual' : 'scan';
  const g = gradeSubmission(exam, req.body.answers);
  const saved = await prisma.$transaction(async (tx) => {
    const sub = await tx.achievementExamSubmission.upsert({
      where: { examId_participantProfileId: { examId: exam.id, participantProfileId } },
      create: { examId: exam.id, participantProfileId, answers: req.body.answers, ...g, source, scannedByUserId: req.session.user.id },
      update: { answers: req.body.answers, ...g, source, scannedByUserId: req.session.user.id },
    });
    if (exam.isPublished) await syncScores(tx, exam, [{ participantProfileId, sectionScores: g.sectionScores }]);
    return sub;
  });
  await log(req, 'UPDATE', exam.id, `${source === 'manual' ? 'กรอก' : 'สแกน'}กระดาษคำตอบ "${exam.title}" ของ "${toFullName(profile)}" ได้ ${g.totalPoints} คะแนน`, 'ACHIEVEMENT_SUBMISSION');
  res.json({ participantProfileId, sectionScores: saved.sectionScores, totalPoints: saved.totalPoints, source: saved.source, updatedAt: saved.updatedAt });
}

async function deleteSubmission(req, res) {
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const participantProfileId = Number(req.params.participantProfileId);
  const deleted = await prisma.achievementExamSubmission.deleteMany({ where: { examId: loaded.exam.id, participantProfileId } });
  if (!deleted.count) return res.status(404).json({ error: 'ไม่พบผลสแกนนี้' });
  await log(req, 'DELETE', loaded.exam.id, `ลบผลสแกนกระดาษคำตอบ "${loaded.exam.title}" (น้องค่าย #${participantProfileId})`, 'ACHIEVEMENT_SUBMISSION');
  res.status(204).end();
}

// ประกาศผล: เขียนคะแนนทุกแผ่นลงตารางคะแนน (น้องค่ายเห็นในหน้าคะแนนของตัวเอง) - หลังประกาศ สแกน/แก้เฉลยเพิ่มจะอัปเดตทันที
async function publishExam(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'ประกาศผลได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const prisma = await getPrisma();
  const loaded = await loadExam(prisma, req, res);
  if (!loaded) return;
  const { exam } = loaded;
  const total = exam.sections.reduce((sum, s) => sum + s.questionCount, 0);
  const missingKey = resizeKey(exam.answerKey, total).filter((k) => k !== '*' && (!Array.isArray(k) || !k.length)).length;
  if (missingKey) return res.status(400).json({ error: `ยังใส่เฉลยไม่ครบ (ขาด ${missingKey} ข้อ)` });
  const subs = await prisma.achievementExamSubmission.findMany({ where: { examId: exam.id } });
  const updated = await prisma.$transaction(async (tx) => {
    await syncScores(tx, exam, subs);
    return tx.achievementExam.update({ where: { id: exam.id }, data: { isPublished: true, publishedAt: new Date() } });
  }, { timeout: 30000 });
  await log(req, 'UPDATE', exam.id, `ประกาศผลสอบวัดผล "${exam.title}" (${subs.length} คน)`);
  res.json(await serializeExam(prisma, updated, { submissionCount: subs.length }));
}

module.exports = {
  listExams,
  createExam,
  updateExam,
  updateAnswerKey,
  deleteExam,
  getRoster,
  listSubmissions,
  saveSubmission,
  deleteSubmission,
  publishExam,
};
