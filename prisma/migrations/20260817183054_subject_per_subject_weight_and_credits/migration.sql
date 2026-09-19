/*
  Warnings:

  - You are about to drop the `academic_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "achievement_weight" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "credits" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "explanation_weight" INTEGER NOT NULL DEFAULT 70;

-- DropTable
DROP TABLE "academic_settings";
