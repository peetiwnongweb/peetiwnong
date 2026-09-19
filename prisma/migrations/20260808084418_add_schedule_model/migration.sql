-- CreateEnum
CREATE TYPE "ScheduleBadgeColor" AS ENUM ('EMERALD', 'ROSE', 'BRAND', 'INDIGO');

-- CreateTable
CREATE TABLE "schedules" (
    "id" SERIAL NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "date_text" TEXT NOT NULL,
    "mobile_date" TEXT NOT NULL,
    "badge_label" TEXT NOT NULL,
    "badge_color" "ScheduleBadgeColor" NOT NULL DEFAULT 'BRAND',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedules_event_date_idx" ON "schedules"("event_date");
