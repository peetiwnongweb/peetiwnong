BEGIN;

-- เพิ่มชื่อเล่นให้ทั้งพี่ค่ายและน้องค่าย ใช้แสดงในระบบและหน้าเว็บได้
ALTER TABLE "staff_profiles" ADD COLUMN "nickname" TEXT;
ALTER TABLE "participant_profiles" ADD COLUMN "nickname" TEXT;

COMMIT;
