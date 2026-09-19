/*
  Warnings:

  - You are about to drop the column `instructor_user_id` on the `subjects` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_instructor_user_id_fkey";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "instructor_user_id";

-- CreateTable
CREATE TABLE "subject_instructors" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_instructors_subject_id_user_id_key" ON "subject_instructors"("subject_id", "user_id");

-- AddForeignKey
ALTER TABLE "subject_instructors" ADD CONSTRAINT "subject_instructors_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_instructors" ADD CONSTRAINT "subject_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
