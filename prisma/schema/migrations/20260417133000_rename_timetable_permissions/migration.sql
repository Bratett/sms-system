-- Rename permission string values that were re-namespaced from `timetable:*`
-- to `exams:*` when the timetable module was removed. Without this backfill,
-- existing role→permission links would reference stale codes and users would
-- silently lose access to rooms + exam schedule features.

-- Rooms
UPDATE "Permission" SET "code" = 'exams:rooms:create' WHERE "code" = 'timetable:rooms:create';
UPDATE "Permission" SET "code" = 'exams:rooms:read'   WHERE "code" = 'timetable:rooms:read';
UPDATE "Permission" SET "code" = 'exams:rooms:update' WHERE "code" = 'timetable:rooms:update';
UPDATE "Permission" SET "code" = 'exams:rooms:delete' WHERE "code" = 'timetable:rooms:delete';

-- Exam schedule (namespaced under `exams:schedule:*` now)
UPDATE "Permission" SET "code" = 'exams:schedule:create' WHERE "code" = 'timetable:exams:create';
UPDATE "Permission" SET "code" = 'exams:schedule:read'   WHERE "code" = 'timetable:exams:read';
UPDATE "Permission" SET "code" = 'exams:schedule:update' WHERE "code" = 'timetable:exams:update';
UPDATE "Permission" SET "code" = 'exams:schedule:delete' WHERE "code" = 'timetable:exams:delete';

-- Drop orphaned permissions whose features were removed entirely. RolePermission
-- rows that reference them cascade automatically via the FK constraint.
DELETE FROM "Permission" WHERE "code" IN (
  'timetable:slots:create',
  'timetable:slots:read',
  'timetable:slots:update',
  'timetable:slots:delete',
  'timetable:slots:generate',
  'timetable:substitutions:create',
  'timetable:substitutions:read',
  'timetable:substitutions:approve',
  'timetable:substitutions:delete',
  'timetable:availability:create',
  'timetable:availability:read',
  'timetable:availability:update',
  'timetable:availability:delete',
  'timetable:versions:create',
  'timetable:versions:read',
  'timetable:versions:publish',
  'timetable:versions:restore'
);
