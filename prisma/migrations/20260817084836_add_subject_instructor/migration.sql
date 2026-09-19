-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "instructor_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_instructor_user_id_fkey" FOREIGN KEY ("instructor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
