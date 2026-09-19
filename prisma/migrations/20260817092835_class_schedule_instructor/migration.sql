-- AlterTable
ALTER TABLE "class_schedules" ADD COLUMN     "instructor_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_instructor_user_id_fkey" FOREIGN KEY ("instructor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
