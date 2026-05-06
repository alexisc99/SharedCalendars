/*
  Warnings:

  - A unique constraint covering the columns `[googleEventId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Event_googleEventId_key" ON "Event"("googleEventId");
