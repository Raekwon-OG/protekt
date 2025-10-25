-- AlterTable
ALTER TABLE "EmailScanLog" ADD COLUMN     "createdByUserId" TEXT,
ALTER COLUMN "orgId" DROP NOT NULL,
ALTER COLUMN "phishingCount" SET DEFAULT 0;
