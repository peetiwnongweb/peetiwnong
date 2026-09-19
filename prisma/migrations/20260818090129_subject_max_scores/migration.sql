-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "achievement_max_score" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "explanation_max_score" INTEGER NOT NULL DEFAULT 100;
