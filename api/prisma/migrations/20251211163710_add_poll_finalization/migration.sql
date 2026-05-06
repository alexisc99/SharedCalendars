/*
  Warnings:

  - A unique constraint covering the columns `[finalizedOptionId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[finalizedEventId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "finalizedEventId" TEXT,
ADD COLUMN     "finalizedOptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_finalizedOptionId_key" ON "Event"("finalizedOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_finalizedEventId_key" ON "Event"("finalizedEventId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_finalizedOptionId_fkey" FOREIGN KEY ("finalizedOptionId") REFERENCES "PollOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_finalizedEventId_fkey" FOREIGN KEY ("finalizedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
