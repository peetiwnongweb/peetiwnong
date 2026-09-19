-- CreateTable
CREATE TABLE "camps" (
    "id" SERIAL NOT NULL,
    "generation_no" INTEGER NOT NULL,
    "president_user_id" INTEGER,
    "secretary_user_id" INTEGER,
    "is_ended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_vice_presidents" (
    "id" SERIAL NOT NULL,
    "camp_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camp_vice_presidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_department_heads" (
    "id" SERIAL NOT NULL,
    "camp_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camp_department_heads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "camps_generation_no_key" ON "camps"("generation_no");

-- CreateIndex
CREATE UNIQUE INDEX "camp_vice_presidents_camp_id_user_id_key" ON "camp_vice_presidents"("camp_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "camp_department_heads_camp_id_department_id_key" ON "camp_department_heads"("camp_id", "department_id");

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_president_user_id_fkey" FOREIGN KEY ("president_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_secretary_user_id_fkey" FOREIGN KEY ("secretary_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_vice_presidents" ADD CONSTRAINT "camp_vice_presidents_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_vice_presidents" ADD CONSTRAINT "camp_vice_presidents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_department_heads" ADD CONSTRAINT "camp_department_heads_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_department_heads" ADD CONSTRAINT "camp_department_heads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "camp_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_department_heads" ADD CONSTRAINT "camp_department_heads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN "camp_generation_no" INTEGER;

-- AlterTable
ALTER TABLE "participant_profiles" ADD COLUMN "camp_generation_no" INTEGER;
