-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'CAMP_CREATE');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "camps" ADD COLUMN     "drive_folder_id" TEXT;

-- CreateTable
CREATE TABLE "camp_backup_runs" (
    "id" SERIAL NOT NULL,
    "camp_id" INTEGER,
    "generation_no" INTEGER,
    "trigger" "BackupTrigger" NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "drive_folder_id" TEXT,
    "snapshot_file_id" TEXT,
    "snapshot_file_name" TEXT,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "total_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "camp_backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "camp_backup_runs_started_at_idx" ON "camp_backup_runs"("started_at");

-- CreateIndex
CREATE INDEX "camp_backup_runs_camp_id_status_idx" ON "camp_backup_runs"("camp_id", "status");

-- AddForeignKey
ALTER TABLE "camp_backup_runs" ADD CONSTRAINT "camp_backup_runs_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
