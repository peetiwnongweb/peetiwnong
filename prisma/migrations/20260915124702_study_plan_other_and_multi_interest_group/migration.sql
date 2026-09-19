/*
  Warnings:

  - Changed the column `interest_subject_group` on the `participant_profiles` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterEnum
ALTER TYPE "StudyPlan" ADD VALUE 'OTHER';

-- AlterTable
-- ตอนแก้ migration นี้เช็คแล้วว่า interest_subject_group เป็น NULL ทุกแถว (ยังไม่มีน้องค่ายกรอกข้อมูลนี้จริง) จึงปลอดภัยที่จะแปลง
-- NULL -> array ว่าง ด้วย USING เอง (Postgres cast สเกลาร์ enum -> enum[] อัตโนมัติไม่ได้ ต้องระบุวิธีแปลงเอง)
ALTER TABLE "participant_profiles" ADD COLUMN     "study_plan_other" TEXT,
ALTER COLUMN "interest_subject_group" SET DATA TYPE "InterestSubjectGroup"[] USING (
  CASE WHEN "interest_subject_group" IS NULL THEN ARRAY[]::"InterestSubjectGroup"[]
       ELSE ARRAY["interest_subject_group"]
  END
);
