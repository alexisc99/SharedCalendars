/*
  Warnings:

  - A unique constraint covering the columns `[calendarId,googleEventId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Event_googleEventId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Event_calendarId_googleEventId_key" ON "Event"("calendarId", "googleEventId");
