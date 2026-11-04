-- DropIndex
DROP INDEX "Submission_status_idx";

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Submission_status_createdAt_idx" ON "Submission"("status", "createdAt");
