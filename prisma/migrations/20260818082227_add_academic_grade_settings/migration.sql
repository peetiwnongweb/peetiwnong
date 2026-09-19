-- CreateTable
CREATE TABLE "academic_grade_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "excellent_min_score" INTEGER NOT NULL DEFAULT 80,
    "very_good_min_score" INTEGER NOT NULL DEFAULT 70,
    "good_min_score" INTEGER NOT NULL DEFAULT 60,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_grade_settings_pkey" PRIMARY KEY ("id")
);
