-- พี่ค่าย 1 คนสังกัดได้หลายฝ่าย: ย้ายจาก staff_profiles.department_id (ฝ่ายเดียว) ไปตาราง staff_profile_departments (หลายต่อหลาย)

-- CreateTable
CREATE TABLE "staff_profile_departments" (
    "staff_profile_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,

    CONSTRAINT "staff_profile_departments_pkey" PRIMARY KEY ("staff_profile_id","department_id")
);

-- CreateIndex
CREATE INDEX "staff_profile_departments_department_id_idx" ON "staff_profile_departments"("department_id");

-- AddForeignKey
ALTER TABLE "staff_profile_departments" ADD CONSTRAINT "staff_profile_departments_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile_departments" ADD CONSTRAINT "staff_profile_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "camp_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ย้ายฝ่ายเดิมของทุกคนมาไว้ในตารางใหม่ก่อนลบคอลัมน์ (ข้อมูลไม่หาย)
INSERT INTO "staff_profile_departments" ("staff_profile_id", "department_id")
SELECT "id", "department_id" FROM "staff_profiles" WHERE "department_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "staff_profiles" DROP CONSTRAINT "staff_profiles_department_id_fkey";

-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "department_id";

-- session เก็บ department (ฝ่ายเดียว) แบบเก่าไว้ ล้างให้ทุกคนล็อกอินใหม่ได้ข้อมูลรูปแบบใหม่ (departments/headDepartment)
DELETE FROM "session";
