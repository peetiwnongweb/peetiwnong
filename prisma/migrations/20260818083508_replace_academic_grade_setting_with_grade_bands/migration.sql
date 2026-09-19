/*
  Warnings:

  - You are about to drop the `academic_grade_settings` table. Replaced by `grade_bands` (a configurable list of score ranges instead of 3 fixed thresholds). Default rows below preserve the previous behavior (>=80 ดีเยี่ยม, >=70 ดีมาก, >=60 ดี, >=1 เข้าร่วม, 0 ไม่ผ่าน).

*/
-- DropTable
DROP TABLE "academic_grade_settings";

-- CreateTable
CREATE TABLE "grade_bands" (
    "id" SERIAL NOT NULL,
    "min_score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

-- SeedData: เกณฑ์เริ่มต้นเดิม (ก่อนเปลี่ยนมาเป็นช่วงคะแนนที่กำหนดเองได้)
INSERT INTO "grade_bands" ("min_score", "max_score", "label", "sort_order", "updated_at") VALUES
    (80, 100, 'ดีเยี่ยม', 0, CURRENT_TIMESTAMP),
    (70, 79, 'ดีมาก', 1, CURRENT_TIMESTAMP),
    (60, 69, 'ดี', 2, CURRENT_TIMESTAMP),
    (1, 59, 'เข้าร่วม', 3, CURRENT_TIMESTAMP),
    (0, 0, 'ไม่ผ่าน', 4, CURRENT_TIMESTAMP);
