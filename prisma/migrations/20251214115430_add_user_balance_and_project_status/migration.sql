-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" "PROJECT_STATUS" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "balance" TEXT NOT NULL DEFAULT '0';
