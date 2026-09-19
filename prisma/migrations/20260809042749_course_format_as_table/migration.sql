/*
  Warnings:

  - You are about to drop the column `course_format` on the `participant_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participant_profiles" DROP COLUMN "course_format",
ADD COLUMN     "course_format_id" INTEGER;

-- DropEnum
DROP TYPE "CourseFormat";

-- CreateTable
CREATE TABLE "course_formats" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_formats_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_course_format_id_fkey" FOREIGN KEY ("course_format_id") REFERENCES "course_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
