/*
  Warnings:

  - You are about to drop the column `position` on the `staff_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "position",
ADD COLUMN     "position_id" INTEGER;

-- DropEnum
DROP TYPE "StaffPosition";

-- CreateTable
CREATE TABLE "staff_positions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_positions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staff_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
