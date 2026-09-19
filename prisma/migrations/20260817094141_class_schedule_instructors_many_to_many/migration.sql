/*
  Warnings:

  - You are about to drop the column `instructor_user_id` on the `class_schedules` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "class_schedules" DROP CONSTRAINT "class_schedules_instructor_user_id_fkey";

-- AlterTable
ALTER TABLE "class_schedules" DROP COLUMN "instructor_user_id";

-- CreateTable
CREATE TABLE "class_schedule_instructors" (
    "id" SERIAL NOT NULL,
    "class_schedule_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_schedule_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_schedule_instructors_class_schedule_id_user_id_key" ON "class_schedule_instructors"("class_schedule_id", "user_id");

-- AddForeignKey
ALTER TABLE "class_schedule_instructors" ADD CONSTRAINT "class_schedule_instructors_class_schedule_id_fkey" FOREIGN KEY ("class_schedule_id") REFERENCES "class_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedule_instructors" ADD CONSTRAINT "class_schedule_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
