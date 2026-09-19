-- CreateTable
CREATE TABLE "camp_activities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_scores" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_scores_activity_id_group_id_key" ON "activity_scores"("activity_id", "group_id");

-- AddForeignKey
ALTER TABLE "activity_scores" ADD CONSTRAINT "activity_scores_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "camp_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_scores" ADD CONSTRAINT "activity_scores_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
