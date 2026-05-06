-- AlterTable
ALTER TABLE "Calendar" ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "premiumSeats" INTEGER;
