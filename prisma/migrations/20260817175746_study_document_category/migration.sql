-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('GENERAL', 'OTHER');

-- AlterTable
ALTER TABLE "study_documents" ADD COLUMN     "category" "DocumentCategory";
