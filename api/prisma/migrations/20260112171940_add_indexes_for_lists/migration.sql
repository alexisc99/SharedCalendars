-- DropIndex
DROP INDEX "AuditLog_entity_entityId_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_calendarId_startDateTime_idx" ON "Event"("calendarId", "startDateTime");

-- CreateIndex
CREATE INDEX "Event_calendarId_status_idx" ON "Event"("calendarId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
