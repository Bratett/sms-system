# Student Profile History Tab

**Date:** 2026-05-01
**Tier 3 #10** of the Students-module feature-depth review.

**Depends on:** existing `AuditLog` model (`prisma/schema/audit.prisma`), `audit()` writer (`src/lib/audit.ts`), `getAuditLogsAction` patterns at `src/modules/auth/actions/audit.action.ts`, and the audit-log UI at `src/app/(dashboard)/admin/audit-log/`.

## 1. Summary

Adds a "History" tab to the student profile page (`/students/[id]`) that surfaces the existing backend audit-log rows scoped to one student. The audit data is already written by every student-lifecycle action (create/update/transfer/withdraw, medical-record edits, document uploads, guardian linking, enrollment changes); this work surfaces it as a per-student timeline.

The tab is gated by the existing `AUDIT_LOG_READ` permission and reuses the table layout from `/admin/audit-log`. It does not introduce new audit writes, new schema, or new permission keys.

## 2. Goals & non-goals

**Goals**
- A "History" tab on the student profile, visible only to users with `AUDIT_LOG_READ` (or wildcard `*`).
- Shows audit rows for **the Student record itself plus its related entities** (MedicalRecord, StudentDocument, Enrollment, StudentGuardian, StudentHouse) in one paginated, newest-first table.
- An action-type filter dropdown (`All` / `CREATE` / `UPDATE` / `DELETE` / `APPROVE` / `REJECT` / `EXPORT` — matching the `AuditAction` enum).
- Click a row to expand and see `previousData` / `newData` JSON diff.
- Strict tenant isolation; defense-in-depth `schoolId` checks on the related-entity ID lookups and the final audit query.
- Page size 25 (matches `/admin/audit-log`).

**Non-goals**
- Date-range, user, entity, or module filters (deferred — power users have `/admin/audit-log`).
- Export of student history to CSV / XLSX.
- New permission key `STUDENTS_HISTORY_READ` (reuse `AUDIT_LOG_READ` for v1).
- Backfilling `metadata.studentId` onto pre-existing audit rows.
- Augmenting future audit writes (medical, document, etc.) to include `metadata.studentId`. (May be revisited later if the cross-reference query becomes a bottleneck.)
- Deep-linking the diff drawer (the expand state is local UI, not URL-encoded).
- Live updates / streaming (page is a snapshot at request time).

## 3. User decisions (recorded from brainstorming)

| Q | Decision |
|---|---|
| Q1 — Scope | B — Student + related-entity audit rows, fetched via cross-reference. |
| Q2 — Permission gate | A — reuse `PERMISSIONS.AUDIT_LOG_READ`; tab hidden when missing. |
| Q3 — Display | A — paginated table mirroring `/admin/audit-log`, click-to-expand for diff. |
| Q4 — Filters | B — action filter only. |

## 4. Architecture

### 4.1 New action: `getStudentHistoryAction`

File: `src/modules/student/actions/history.action.ts`

Signature:

```typescript
export async function getStudentHistoryAction(input: {
  studentId: string;
  action?: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "IMPORT" | "APPROVE" | "REJECT" | "PUBLISH";
  page?: number;
  pageSize?: number;
}): Promise<
  | { error: string }
  | {
      data: Array<{
        id: string;
        timestamp: Date;
        action: string;
        entity: string;
        entityId: string | null;
        module: string;
        description: string;
        userName: string | null;
        userUsername: string | null;
        previousData: unknown;
        newData: unknown;
      }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }
>;
```

Behavior:

1. `requireSchoolContext()` — auth + school resolution.
2. `assertPermission(ctx.session, PERMISSIONS.AUDIT_LOG_READ)` — gate.
3. Verify the student belongs to the caller's school (`db.student.findFirst({ where: { id: studentId, schoolId } })`); if missing, return `{ error: "Student not found" }`.
4. **In parallel**, fetch the student's owned-entity ID lists (each query school-scoped):
   - `medicalRecord.findMany({ where: { studentId, schoolId }, select: { id: true } })`
   - `studentDocument.findMany({ where: { studentId, schoolId }, select: { id: true } })`
   - `enrollment.findMany({ where: { studentId, schoolId }, select: { id: true } })`
   - `studentGuardian.findMany({ where: { studentId, schoolId }, select: { id: true } })`
   - `studentHouse.findMany({ where: { studentId, schoolId }, select: { id: true } })`
5. Build the audit-query `where` clause:
   ```typescript
   {
     schoolId: ctx.schoolId,                               // defense in depth
     OR: [
       { entity: "Student", entityId: studentId },
       { entityId: { in: relatedIds } },                   // concatenated from step 4
     ],
     ...(action ? { action } : {}),
   }
   ```
6. Run `auditLog.count({ where })` and `auditLog.findMany({ where, include: { user }, orderBy: { timestamp: "desc" }, skip, take })` in parallel.
7. Map rows to the return shape (mirroring the existing `getAuditLogsAction` field names: `userName`, `userUsername` derived from the joined `user`).

Defaults: `page = 1`, `pageSize = 25`. Page size capped at 100 server-side.

### 4.2 New tab on student profile

Files:
- Modify: `src/app/(dashboard)/students/[id]/student-profile.tsx` — insert the History tab into the existing tab list and conditionally render its content based on `permissions.includes("*") || permissions.includes(PERMISSIONS.AUDIT_LOG_READ)`.
- Create: `src/app/(dashboard)/students/[id]/history-tab.tsx` — client component for the table + filter + diff expansion.

The tab appears after the existing "Documents" tab. When the caller lacks the permission, the tab trigger is not rendered at all (graceful — they don't see a forbidden message).

### 4.3 History tab client component

`src/app/(dashboard)/students/[id]/history-tab.tsx`:

- `"use client"` directive.
- Props: `{ studentId: string }`. The component is self-contained — it calls `getStudentHistoryAction` itself via `useTransition` rather than receiving data via the parent (matches the pattern of other lazy-loaded student tabs like the boarding tab).
- State: `action` filter, `page`, fetched `data`, `pagination`, `isPending`, `error`, `expandedRowId`.
- On mount and on filter/page change, calls the action and updates state.
- Renders:
  - Action filter `Select` (re-uses the existing `Select` UI component from elsewhere in the dashboard).
  - Table with columns: Timestamp · Action · Entity · Description · By.
  - Each row is clickable; clicking sets `expandedRowId` and reveals a sub-row that pretty-prints `previousData` and `newData` as JSON in a `<pre>` block. Clicking again collapses.
  - Pagination footer: "Showing N–M of T", prev/next buttons, page indicator. Match `/admin/audit-log` UX.
  - Empty state: "No history yet for this student" — when `data.length === 0` and no filter applied.
  - Filtered-empty state: "No history matches the {action} filter" — when filter is set and result is empty.

### 4.4 Tenant isolation

- Step 3 of the action verifies the student belongs to caller's school.
- All 5 related-entity ID queries explicitly include `schoolId: ctx.schoolId` (in addition to `studentId`) so that even if a stray foreign-school record was linked to this `studentId` via some bug, it does not leak into the audit query.
- The audit query itself includes `schoolId: ctx.schoolId` as a top-level filter — every audit row carries `schoolId` already, so this is the strongest of the three gates.

## 5. Permission and visibility

- The action gate is `assertPermission(ctx.session, PERMISSIONS.AUDIT_LOG_READ)`. Without this permission the action returns `{ error: "Permission denied: ..." }`.
- The tab trigger in `student-profile.tsx` is conditionally rendered based on the same permission check on the session object. When missing, the tab simply does not appear — neither the trigger nor the content.

## 6. UI patterns

- Table styling, action filter Select, expand mechanism, and pagination match `/admin/audit-log/audit-log-client.tsx`. Re-use Tailwind classes verbatim — do NOT extract a shared component yet (would couple two surfaces unnecessarily for a thin reuse). YAGNI.
- Diff display: side-by-side `<pre>` blocks for `previousData` and `newData` (or stacked on narrow screens). When either is null, render "—" in its slot.
- The "By" column shows `userName ?? userUsername ?? "System"`; "System" appears for rows where the joined user is null (audit rows for system actions).

## 7. Testing strategy

Tests under `tests/unit/student/history.test.ts`:

- Permission test: caller without `AUDIT_LOG_READ` gets `{ error }`.
- School scoping: caller from school A querying a school B student gets `{ error: "Student not found" }`.
- Returns rows for student-direct audit entries.
- Returns rows for related-entity audit entries (synthesize a `MedicalRecord.id` whose audit row should appear via the cross-reference).
- Action filter narrows results.
- Pagination: total count + skip/take work correctly across pages.
- Empty-result path with no rows is non-error.

UI test (manual / smoke): tab visible for super_admin, hidden for a teacher session with no audit permission.

## 8. Edge cases captured

- Student has zero related entities → action runs with `entityId: { in: [] }` branch; Prisma handles this safely (returns nothing for that disjunct, plus the direct Student-entity rows).
- Student belongs to a different school → `findFirst` returns null, action returns `{ error: "Student not found" }` (intentionally mirrors a real not-found rather than leaking that the student exists elsewhere).
- Session has `permissions: ["*"]` → wildcard treated as having `AUDIT_LOG_READ` (matches existing `assertPermission` behavior).
- An audit row exists for an entityId that no longer exists (e.g., student document was deleted) — this is FINE; we still display the row with its description. We never join entity-side data, only the user.
- The action enum is broader than what we filter on. We accept any of the values in `AuditAction` enum but only show the dropdown options listed in §2 goals (the others — LOGIN/LOGOUT/IMPORT/PUBLISH — are unlikely to apply to per-student history).

## 9. Verification plan

1. `npm run dev`, log in as super_admin, navigate to `/students/[id]` — confirm the History tab appears.
2. Make a state change (e.g., update a medical record, upload a document, edit student name) — refresh the profile, switch to History tab — confirm the new audit row appears at the top.
3. Toggle the action filter to "UPDATE" — confirm only UPDATE rows show.
4. Click an UPDATE row — confirm the diff drawer opens with `previousData` / `newData`.
5. Click a CREATE row — confirm the drawer shows `newData` only (previousData is null).
6. Log in as a teacher account (no `AUDIT_LOG_READ`) — confirm the tab is not rendered.
7. Log in as a user from school B — navigate to a school-A student URL directly — confirm the action errors with "Student not found".
8. Run `npm test src/modules/student/__tests__/history.test.ts` (or wherever the new tests land) — all green.

## 10. Out of scope (deferred)

- Date-range / entity / user / module filters
- CSV / XLSX export of student history
- New `STUDENTS_HISTORY_READ` permission for narrower access
- Backfilling `metadata.studentId` on existing audit rows
- Augmenting future audit writes to consistently include `metadata.studentId` (would simplify the cross-reference query to one `metadata @> { studentId }` filter)
- Pre-fetching the diff so the expand is instant (each row already carries its diff in the response payload — there is no second query, so this is already instant)
- Linking from a row directly to the related entity (e.g., clicking a MedicalRecord row → opens the medical record edit dialog)
