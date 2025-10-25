-- CreateTable
CREATE TABLE "EmailScanLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "from" TEXT,
    "subject" TEXT,
    "text" TEXT,
    "urls" JSONB NOT NULL,
    "verdictSummary" TEXT NOT NULL,
    "phishingCount" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailScanLog_pkey" PRIMARY KEY ("id")
);
