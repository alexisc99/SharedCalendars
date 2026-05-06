/*
  Warnings:

  - A unique constraint covering the columns `[publicIcsToken]` on the table `Calendar` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Calendar" ADD COLUMN     "publicIcsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicIcsToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_publicIcsToken_key" ON "Calendar"("publicIcsToken");
