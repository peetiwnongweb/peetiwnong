-- CreateEnum
CREATE TYPE "Prefix" AS ENUM ('DEK_CHAI', 'DEK_YING', 'NAI', 'NANG', 'NANGSAO');

-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('FOUNDATION', 'EXAM_PREP');

-- CreateEnum
CREATE TYPE "StudyPlan" AS ENUM ('SCIENCE_MATH', 'ARTS_MATH', 'ARTS_LANGUAGE', 'ARTS_SOCIAL');

-- CreateEnum
CREATE TYPE "InterestSubjectGroup" AS ENUM ('ENGINEERING_TECH', 'SCIENCE', 'HEALTH', 'EDUCATION', 'HUMANITIES_SOCIAL', 'ART_DESIGN', 'MEDIA_DIGITAL_TECH', 'OTHER');

-- CreateEnum
CREATE TYPE "CampDepartment" AS ENUM ('ACADEMIC', 'ACTIVITY_RECREATION', 'DISCIPLINE_FACILITY', 'TECH_PR');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'DEPARTMENT_HEAD', 'STAFF_MEMBER');

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "prefix" "Prefix",
    "first_name" TEXT,
    "last_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "phone" TEXT,
    "parent_phone" TEXT,
    "course_format" "CourseFormat",
    "study_plan" "StudyPlan",
    "interest_subject_group" "InterestSubjectGroup",
    "dream_institution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "prefix" "Prefix",
    "academic_title" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "phone" TEXT,
    "department" "CampDepartment",
    "position" "StaffPosition",
    "affiliation" TEXT,
    "occupation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_user_id_key" ON "participant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
