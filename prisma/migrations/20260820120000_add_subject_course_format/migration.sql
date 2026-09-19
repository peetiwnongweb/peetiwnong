ALTER TABLE "subjects" ADD COLUMN "course_format_id" INTEGER NOT NULL;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_format_id_fkey" FOREIGN KEY ("course_format_id") REFERENCES "course_formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
