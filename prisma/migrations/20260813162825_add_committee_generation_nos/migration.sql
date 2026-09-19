-- AlterTable
ALTER TABLE "committees" ADD COLUMN     "generation_nos" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
