BEGIN;

-- แยกสวิตช์ "เปิดรับลงทะเบียน" ปุ่มเดียวออกเป็น 2 อัน (พี่ค่าย/น้องค่าย) ใช้ค่าเดิมจาก registration_open เป็นค่าเริ่มต้นของทั้งคู่ ไม่มีข้อมูลผู้ใช้จริงอยู่ในค่านี้จึงไม่ต้องย้ายข้อมูลซับซ้อน
ALTER TABLE "site_settings" ADD COLUMN "staff_registration_open" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "site_settings" ADD COLUMN "participant_registration_open" BOOLEAN NOT NULL DEFAULT true;

UPDATE "site_settings" SET "staff_registration_open" = "registration_open", "participant_registration_open" = "registration_open";

ALTER TABLE "site_settings" DROP COLUMN "registration_open";

COMMIT;
