/*
  Warnings:

  - You are about to drop the column `day_label` on the `class_schedules` table. All the data in the column will be lost.
  - Added the required column `class_date` to the `class_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "class_schedules" DROP COLUMN "day_label",
ADD COLUMN     "class_date" DATE NOT NULL;
