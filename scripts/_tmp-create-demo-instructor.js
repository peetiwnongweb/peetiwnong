require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../backend/lib/prisma');

(async () => {
  const prisma = await getPrisma();
  const dept = await prisma.campDepartment.findFirst({ where: { name: 'ฝ่ายวิชาการ' } });
  if (!dept) { console.log(JSON.stringify({ error: 'no dept' })); process.exit(1); }

  const passwordHash = await bcrypt.hash('Test1234!', 10);
  const user = await prisma.user.create({
    data: {
      email: 'zz-demo-akhom@test.invalid',
      passwordHash,
      role: 'STAFF',
      approvalStatus: 'APPROVED',
      staffProfile: {
        create: {
          prefix: 'นาย', firstName: 'อาคม', lastName: 'ใจดี', nickname: 'อาคม',
          departmentId: dept.id,
        },
      },
    },
    include: { staffProfile: true },
  });
  console.log(JSON.stringify({ userId: user.id, staffProfileId: user.staffProfile.id }));
  await prisma.$disconnect();
})();
