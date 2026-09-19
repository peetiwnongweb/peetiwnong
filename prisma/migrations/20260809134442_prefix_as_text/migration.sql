BEGIN;

-- prefix เดิมเป็น enum (เก็บแค่ NAI/NANG/NANGSAO/DEK_CHAI/DEK_YING) เปลี่ยนเป็น text ธรรมดา
-- เพื่อให้เก็บค่าจริงเป็นภาษาไทย (นาย/นาง/นางสาว/เด็กชาย/เด็กหญิง) ได้ตรง ๆ ไม่ต้องแปลตอนแสดงผล/นำออก
ALTER TABLE "staff_profiles" ALTER COLUMN "prefix" TYPE TEXT USING "prefix"::TEXT;
ALTER TABLE "participant_profiles" ALTER COLUMN "prefix" TYPE TEXT USING "prefix"::TEXT;

DROP TYPE "Prefix";

COMMIT;
