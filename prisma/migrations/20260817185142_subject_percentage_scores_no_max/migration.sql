-- Remove per-subject max-score fields; scores are now entered as a direct 0-100 percentage per exam type
ALTER TABLE "subjects" DROP COLUMN "explanation_max_score";
ALTER TABLE "subjects" DROP COLUMN "achievement_max_score";
