/*
  Warnings:

  - You are about to drop the column `explanation_weight` and `achievement_weight` on the `subjects` table. Replaced by a single global `score_weight_settings` row (seeded below with the same 70:30 values every existing subject already had) shared across all subjects that require scoring, instead of a per-subject setting.

*/
-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "requires_scoring" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "achievement_weight",
DROP COLUMN "explanation_weight";

-- CreateTable
CREATE TABLE "score_weight_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "explanation_weight" INTEGER NOT NULL DEFAULT 70,
    "achievement_weight" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_weight_settings_pkey" PRIMARY KEY ("id")
);

-- SeedData: ค่าเริ่มต้นตรงกับสัดส่วนเดิมที่ทุกวิชามีอยู่ก่อนย้ายมาเป็นค่ากลาง (70:30)
INSERT INTO "score_weight_settings" ("id", "explanation_weight", "achievement_weight", "updated_at") VALUES
    (1, 70, 30, CURRENT_TIMESTAMP);
