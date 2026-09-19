/*
  Warnings:

  - You are about to drop the column `category` on the `study_documents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "study_documents" DROP COLUMN "category";

-- DropEnum
DROP TYPE "DocumentCategory";
