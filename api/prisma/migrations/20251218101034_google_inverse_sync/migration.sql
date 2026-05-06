-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleImportedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MYAPP';
