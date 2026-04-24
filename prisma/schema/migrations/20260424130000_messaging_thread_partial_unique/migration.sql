-- Replace the global unique index on (studentId, teacherUserId) with a partial
-- unique index that only applies to ACTIVE threads. This allows creating a new
-- ACTIVE thread after a prior thread between the same student+teacher pair has
-- been ARCHIVED (e.g. on lifecycle transitions or admin archive).

DROP INDEX "MessageThread_studentId_teacherUserId_key";

CREATE INDEX "MessageThread_studentId_teacherUserId_idx" ON "MessageThread"("studentId", "teacherUserId");

CREATE UNIQUE INDEX "MessageThread_studentId_teacherUserId_active_key" ON "MessageThread"("studentId", "teacherUserId") WHERE status = 'ACTIVE';
