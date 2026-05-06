/*
  Warnings:

  - A unique constraint covering the columns `[groupPlanId]` on the table `Calendar` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Calendar" ADD COLUMN     "groupPlanId" TEXT;

-- CreateTable
CREATE TABLE "GroupPlan" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupPlan_calendarId_key" ON "GroupPlan"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_groupPlanId_key" ON "Calendar"("groupPlanId");

-- AddForeignKey
ALTER TABLE "GroupPlan" ADD CONSTRAINT "GroupPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPlan" ADD CONSTRAINT "GroupPlan_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
