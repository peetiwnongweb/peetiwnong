-- Existing activity_logs rows are dev/test data from this session; clearing them
-- avoids backfilling actor_email with placeholder values that would be wrong anyway.
TRUNCATE TABLE "activity_logs";

-- AlterTable
ALTER TABLE "activity_logs" DROP COLUMN "actor_username",
ADD COLUMN     "actor_email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "username";
