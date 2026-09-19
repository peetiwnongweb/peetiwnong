-- Drop the old single-value generation_no column now that generation_nos (Int[])
-- has been backfilled for every existing row (see backfill script run before this migration).
ALTER TABLE "committees" DROP COLUMN "generation_no";
