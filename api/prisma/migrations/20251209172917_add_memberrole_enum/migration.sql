/*
  Warnings:

  - Changed the type of `role` on the `CalendarMember` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'editor', 'viewer', 'member');

-- AlterTable
ALTER TABLE "CalendarMember" DROP COLUMN "role",
ADD COLUMN     "role" "MemberRole" NOT NULL;
