-- CreateEnum
CREATE TYPE "CalendarSyncMode" AS ENUM ('NONE', 'MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "Calendar" ADD COLUMN     "syncMode" "CalendarSyncMode" NOT NULL DEFAULT 'MANUAL';
