/*
  Warnings:

  - You are about to drop the column `coverUrl` on the `Calendar` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Calendar" DROP COLUMN "coverUrl",
ADD COLUMN     "color" TEXT,
ADD COLUMN     "coverImageUrl" TEXT;
