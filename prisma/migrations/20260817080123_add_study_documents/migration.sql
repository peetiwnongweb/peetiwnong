-- CreateTable
CREATE TABLE "study_documents" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "course_format_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "study_documents" ADD CONSTRAINT "study_documents_course_format_id_fkey" FOREIGN KEY ("course_format_id") REFERENCES "course_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
