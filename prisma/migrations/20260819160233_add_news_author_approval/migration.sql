-- AlterTable
ALTER TABLE "news" ADD COLUMN     "author_user_id" INTEGER;
ALTER TABLE "news" ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
