-- ระบบสอบวัดผลสัมฤทธิ์แบบฝนกระดาษคำตอบ + สแกนตรวจ (OMR)
CREATE TABLE "achievement_exams" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "course_format_id" INTEGER NOT NULL,
    "choice_count" INTEGER NOT NULL DEFAULT 4,
    "choice_style" TEXT NOT NULL DEFAULT 'thai',
    "sections" JSONB NOT NULL,
    "answer_key" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "achievement_exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "achievement_exam_submissions" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "participant_profile_id" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "section_scores" JSONB NOT NULL,
    "total_points" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'scan',
    "scanned_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "achievement_exam_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "achievement_exam_submissions_exam_id_participant_profile_id_key" ON "achievement_exam_submissions"("exam_id", "participant_profile_id");

ALTER TABLE "achievement_exam_submissions" ADD CONSTRAINT "achievement_exam_submissions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "achievement_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "achievement_exam_submissions" ADD CONSTRAINT "achievement_exam_submissions_participant_profile_id_fkey" FOREIGN KEY ("participant_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
