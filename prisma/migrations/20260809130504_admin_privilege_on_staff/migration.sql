BEGIN;

-- Decouple audit log actor_role from the UserRole enum: historical log rows must stay valid
-- even after roles/enum values change in the future.
ALTER TABLE "activity_logs" ALTER COLUMN "actor_role" TYPE TEXT USING "actor_role"::TEXT;

-- Remove ADMIN from UserRole. "Admin" is no longer its own account role — it becomes a privilege
-- granted to a STAFF member via StaffProfile.is_admin (see below). The ADMIN-role account was
-- deleted before running this migration.
CREATE TYPE "UserRole_new" AS ENUM ('HOST', 'STAFF', 'PARTICIPANT');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::TEXT::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";

-- Admin privilege flag on staff profiles: only a HOST account may grant/revoke this.
ALTER TABLE "staff_profiles" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
