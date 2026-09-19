require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../backend/lib/prisma');

(async () => {
  const prisma = await getPrisma();
  const password = 'Test1234!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.deleteMany({ where: { email: { startsWith: 'zz-demo-' } } });
  await prisma.camp.deleteMany({ where: { generationNo: 28 } });
  await prisma.subject.deleteMany({ where: { name: { startsWith: 'zz-demo-' } } });

  await prisma.camp.create({ data: { generationNo: 28 } });

  const wm = await prisma.user.create({
    data: { email: 'zz-demo-wm@test.invalid', passwordHash, role: 'WEBMANAGER', approvalStatus: 'APPROVED' },
  });

  const examPrep = await prisma.courseFormat.findFirst({ where: { name: 'เตรียมสอบ' } });

  const subjects = [];
  for (const [name, credits] of [['zz-demo-คณิตศาสตร์', 2], ['zz-demo-ฟิสิกส์', 1.5], ['zz-demo-ภาษาอังกฤษ', 1]]) {
    subjects.push(await prisma.subject.create({
      data: { name, courseFormatId: examPrep.id, credits, explanationMaxScore: 100, achievementMaxScore: 100 },
    }));
  }

  const names = [
    { firstName: 'สมชาย', lastName: 'ใจดี', nickname: 'ชาย' },
    { firstName: 'สมหญิง', lastName: 'รักเรียน', nickname: 'หญิง' },
    { firstName: 'วิชัย', lastName: 'ตั้งใจ', nickname: 'ชัย' },
  ];

  const participants = [];
  for (const n of names) {
    const p = await prisma.user.create({
      data: {
        email: `zz-demo-${n.nickname}@test.invalid`,
        passwordHash,
        role: 'PARTICIPANT',
        approvalStatus: 'APPROVED',
        participantProfile: {
          create: { ...n, courseFormatId: examPrep.id, campGenerationNo: 28 },
        },
      },
      include: { participantProfile: true },
    });
    participants.push(p);
  }

  console.log(JSON.stringify({
    wmId: wm.id,
    subjectIds: subjects.map((s) => s.id),
    participantProfileIds: participants.map((p) => p.participantProfile.id),
  }));
  await prisma.$disconnect();
})();
