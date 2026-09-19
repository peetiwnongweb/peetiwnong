-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "participant_auto_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staff_auto_approve" BOOLEAN NOT NULL DEFAULT false;
