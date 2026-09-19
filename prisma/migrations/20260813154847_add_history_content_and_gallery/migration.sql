-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "history_body" TEXT,
ADD COLUMN     "history_title" TEXT;

-- CreateTable
CREATE TABLE "gallery_photos" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_photos_pkey" PRIMARY KEY ("id")
);
