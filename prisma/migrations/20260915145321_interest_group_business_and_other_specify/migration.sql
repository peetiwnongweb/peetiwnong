-- AlterEnum
ALTER TYPE "InterestSubjectGroup" ADD VALUE 'BUSINESS';

-- AlterTable
ALTER TABLE "participant_profiles" ADD COLUMN     "interest_subject_group_other" TEXT;
