-- DropIndex
DROP INDEX "AuditLog_userId_createdAt_idx";

-- DropIndex
DROP INDEX "Event_calendarId_startDateTime_idx";

-- DropIndex
DROP INDEX "Event_calendarId_status_idx";

-- DropIndex
DROP INDEX "Notification_userId_createdAt_idx";

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_id_idx" ON "AuditLog"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Comment_eventId_createdAt_id_idx" ON "Comment"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Event_calendarId_startDateTime_id_idx" ON "Event"("calendarId", "startDateTime", "id");

-- CreateIndex
CREATE INDEX "Event_startDateTime_id_idx" ON "Event"("startDateTime", "id");

-- CreateIndex
CREATE INDEX "Event_calendarId_status_startDateTime_idx" ON "Event"("calendarId", "status", "startDateTime");

-- CreateIndex
CREATE INDEX "Event_calendarId_updatedAt_idx" ON "Event"("calendarId", "updatedAt");

-- CreateIndex
CREATE INDEX "File_eventId_createdAt_id_idx" ON "File"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "File_calendarId_createdAt_id_idx" ON "File"("calendarId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");
