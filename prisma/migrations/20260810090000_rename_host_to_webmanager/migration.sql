BEGIN;

-- เปลี่ยนชื่อ role "HOST" เป็น "WEBMANAGER" (แยกสิทธิ์สูงสุดออกจาก Admin โดยสิ้นเชิง มีหน้า login และแผงควบคุมของตัวเองที่ /webmanager)
-- RENAME VALUE เป็นการเปลี่ยนชื่อ enum แบบ atomic ไม่กระทบข้อมูลที่มีอยู่ (บัญชี Host เดิมจะกลายเป็น WebManager ทันทีโดยไม่ต้อง UPDATE แถวข้อมูล)
ALTER TYPE "UserRole" RENAME VALUE 'HOST' TO 'WEBMANAGER';

COMMIT;
