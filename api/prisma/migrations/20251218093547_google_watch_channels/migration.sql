-- CreateTable
CREATE TABLE "GoogleWatchChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleWatchChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleWatchChannel_userId_idx" ON "GoogleWatchChannel"("userId");
