require('dotenv').config();
const { getPrisma } = require('../backend/lib/prisma');

(async () => {
  const prisma = await getPrisma();

  const baseCourseFormat = await prisma.courseFormat.findFirst({ where: { name: 'เตรียมสอบ' } });
  const otherCourseFormat = await prisma.courseFormat.findFirst({ where: { name: 'ปรับพื้นฐาน' } });

  const docs = [
    {
      title: 'zz-demo-เอกสารประกอบการเรียนคณิตศาสตร์',
      description: 'สรุปเนื้อหาบทที่ 1-3',
      courseFormatId: baseCourseFormat?.id ?? null,
    },
    {
      title: 'zz-demo-สรุปสูตรฟิสิกส์',
      description: 'สูตรที่ออกสอบบ่อย',
      courseFormatId: baseCourseFormat?.id ?? null,
    },
    {
      title: 'zz-demo-แบบฝึกหัดภาษาอังกฤษ',
      description: null,
      courseFormatId: otherCourseFormat?.id ?? null,
    },
    {
      title: 'zz-demo-กำหนดการค่าย',
      description: 'ตารางกิจกรรมโดยรวมทั้งค่าย',
      courseFormatId: null,
    },
  ];

  const created = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const row = await prisma.studyDocument.create({
      data: {
        title: d.title,
        description: d.description,
        fileUrl: `https://drive.google.com/file/d/zz-demo-placeholder-${i + 1}/view`,
        driveFileId: `zz-demo-fake-file-id-${i + 1}`,
        courseFormatId: d.courseFormatId,
      },
    });
    created.push(row.id);
  }

  console.log(JSON.stringify({ createdIds: created }));
  await prisma.$disconnect();
})();
