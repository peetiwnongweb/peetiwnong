const fs = require('fs');
const path = require('path');

// generator ในหน้า schema.prisma ยังไม่รองรับ output แบบ CommonJS เต็มรูปแบบ
// (ยังคง import/export ในไฟล์ .ts) ต้องประกาศ "type":"module" ในโฟลเดอร์ที่ generate ออกมา
// เพื่อให้ dynamic import() จาก backend/lib/prisma.js (CommonJS) โหลดได้ถูกต้อง
const target = path.join(__dirname, '..', 'generated', 'prisma', 'package.json');
fs.writeFileSync(target, JSON.stringify({ type: 'module' }, null, 2) + '\n');
console.log(`wrote ${target}`);
