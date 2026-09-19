BEGIN;

-- ย้าย avatar_url จาก staff_profiles มาไว้ที่ users แทน (ทุก role ควรมีรูปโปรไฟล์ได้ ไม่ใช่แค่พี่ค่าย)
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

UPDATE "users" u
SET "avatar_url" = sp."avatar_url"
FROM "staff_profiles" sp
WHERE sp."user_id" = u."id" AND sp."avatar_url" IS NOT NULL;

ALTER TABLE "staff_profiles" DROP COLUMN "avatar_url";

COMMIT;
