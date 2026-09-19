-- CreateEnum
CREATE TYPE "NewsTag" AS ENUM ('ANNOUNCE', 'ACTIVITY', 'SCHOLAR', 'OTHER');

-- CreateTable
CREATE TABLE "committees" (
    "id" SERIAL NOT NULL,
    "generation_no" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "tag" "NewsTag" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "image_url" TEXT,
    "is_hot" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "committees_generation_no_key" ON "committees"("generation_no");

-- CreateIndex
CREATE INDEX "news_published_at_idx" ON "news"("published_at");
