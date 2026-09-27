-- Rename role WebManager -> SuperAdmin everywhere (enum, stats column, historical string data)
ALTER TYPE "UserRole" RENAME VALUE 'WEBMANAGER' TO 'SUPERADMIN';
ALTER TABLE "usage_hourly_stats" RENAME COLUMN "webmanager_requests" TO "superadmin_requests";
UPDATE "activity_logs" SET "actor_role" = 'SUPERADMIN' WHERE "actor_role" = 'WEBMANAGER';
UPDATE "usage_daily_active_users" SET "role" = 'SUPERADMIN' WHERE "role" = 'WEBMANAGER';
UPDATE "users" SET "avatar_url" = REPLACE("avatar_url", '/avatars/webmanager/', '/avatars/superadmin/') WHERE "avatar_url" LIKE '%/avatars/webmanager/%';
-- sessions store the old role string; clear them so everyone logs in fresh with the new role
DELETE FROM "session";
