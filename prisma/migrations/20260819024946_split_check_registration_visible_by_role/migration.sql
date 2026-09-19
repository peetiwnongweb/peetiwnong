-- แยกสวิตช์ "ตรวจสอบผลการลงทะเบียน" เป็นแยกพี่ค่าย/น้องค่าย จากเดิมเป็นสวิตช์เดียวรวม
ALTER TABLE "site_settings" ADD COLUMN "check_registration_visible_staff" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "site_settings" ADD COLUMN "check_registration_visible_participant" BOOLEAN NOT NULL DEFAULT true;

-- คงค่าเดิมไว้ทั้งสองฝั่งก่อนลบคอลัมน์เก่า
UPDATE "site_settings" SET
  "check_registration_visible_staff" = "check_registration_visible",
  "check_registration_visible_participant" = "check_registration_visible";

ALTER TABLE "site_settings" DROP COLUMN "check_registration_visible";
