-- CreateEnum
CREATE TYPE "OralExamSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OralExamAttemptStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "oral_exam_sessions" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "opened_by_user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "status" "OralExamSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "oral_exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oral_exam_attempts" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "participant_profile_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "OralExamAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_at" TIMESTAMP(3),
    "evaluated_by_user_id" INTEGER,
    "awarded_score" INTEGER,

    CONSTRAINT "oral_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oral_exam_score_bands" (
    "id" SERIAL NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "score_percent" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oral_exam_score_bands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oral_exam_sessions_token_key" ON "oral_exam_sessions"("token");

-- CreateIndex
CREATE INDEX "oral_exam_sessions_subject_id_status_idx" ON "oral_exam_sessions"("subject_id", "status");

-- CreateIndex
CREATE INDEX "oral_exam_attempts_participant_profile_id_subject_id_idx" ON "oral_exam_attempts"("participant_profile_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "oral_exam_attempts_session_id_participant_profile_id_key" ON "oral_exam_attempts"("session_id", "participant_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "oral_exam_score_bands_attempt_number_key" ON "oral_exam_score_bands"("attempt_number");

-- AddForeignKey
ALTER TABLE "oral_exam_sessions" ADD CONSTRAINT "oral_exam_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oral_exam_sessions" ADD CONSTRAINT "oral_exam_sessions_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oral_exam_attempts" ADD CONSTRAINT "oral_exam_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "oral_exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oral_exam_attempts" ADD CONSTRAINT "oral_exam_attempts_participant_profile_id_fkey" FOREIGN KEY ("participant_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oral_exam_attempts" ADD CONSTRAINT "oral_exam_attempts_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oral_exam_attempts" ADD CONSTRAINT "oral_exam_attempts_evaluated_by_user_id_fkey" FOREIGN KEY ("evaluated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
