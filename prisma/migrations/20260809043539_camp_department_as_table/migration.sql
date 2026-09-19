/*
  Warnings:

  - You are about to drop the column `department` on the `staff_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "department",
ADD COLUMN     "department_id" INTEGER;

-- DropEnum
DROP TYPE "CampDepartment";

-- CreateTable
CREATE TABLE "camp_departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_departments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "camp_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
