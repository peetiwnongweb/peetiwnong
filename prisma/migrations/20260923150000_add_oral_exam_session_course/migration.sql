-- AlterTable
ALTER TABLE "oral_exam_sessions" ADD COLUMN "course_format_id" INTEGER;

-- AddForeignKey
ALTER TABLE "oral_exam_sessions" ADD CONSTRAINT "oral_exam_sessions_course_format_id_fkey" FOREIGN KEY ("course_format_id") REFERENCES "course_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
