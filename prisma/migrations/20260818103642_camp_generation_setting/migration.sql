-- CreateTable
CREATE TABLE "camp_generation_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "generation_no" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_generation_settings_pkey" PRIMARY KEY ("id")
);
