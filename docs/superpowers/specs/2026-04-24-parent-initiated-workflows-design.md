# Parent-Initiated Workflows — Design

**Date:** 2026-04-24
**Status:** Approved
**Tier:** 2 — part of item #6 (Parent Portal Upgrade). Sub-project **C** of the four identified sub-projects.

## 1. Context

Sub-project B (Parent ↔ Teacher Messaging) shipped in PR #26. This sub-project tackles sub-project **C**: parent-initiated workflows that require staff review. Two workflows ship together:

1. **Excuse an absence.** Parent submits a reason (and optional medical certificate) for one or more of their child's absences. A class teacher or housemaster reviews and approves or rejects. On approval, attendance records flip to `EXCUSED`.
2. **Disclose medical info.** Parent discloses an allergy, ongoing condition, or current medication for their child. A school nurse reviews and approves or rejects. On approval, a new `MedicalRecord` row is created and the nurse is optionally prompted to sync to the student's denormalized `allergies` / `medicalConditions` strings.

Both use the same two-stage state machine (`PENDING → APPROVED | REJECTED | WITHDRAWN`), reuse the messaging attachment helpers (MIME allowlist, 5 MB cap, R2 HEAD verification), and plug into the existing `NotificationPreference` + `sendMessage` hub.

**Explicitly out of scope** (other sub-projects of #6):
- **D** — acknowledgements for circulars / report cards
- Forward-dated absence requests (those route through the existing exeat flow)
- Medical categories beyond `ALLERGY`/`CONDITION`/`MEDICATION` — `ILLNESS`, `IMMUNIZATION`, `OTHER` deferred
- Direct parent editing of `Student.allergies`/`Student.medicalConditions` (only the nurse can, post-approval)
- Tiered review (e.g. headmaster escalation on multi-day absences)

## 2. Scope

**In scope**
- `ExcuseRequest` + `MedicalDisclosure` models, four-state status enum each
- Four new permissions (submit/review for each workflow)
- Four new notification events + channel defaults
- Server actions for submit/withdraw/list/get/approve/reject per workflow
- Shared attachment helpers reused from messaging (R2 + HEAD verification + ContentLength binding)
- Three UI surfaces: parent `/parent/requests`, staff `/staff/excuse-reviews`, admin `/students/medical-disclosures`
- Student-lifecycle hooks: auto-withdraw pending requests on TRANSFERRED/WITHDRAWN/GRADUATED
- 7-year retention added to the existing retention sweep

**Out of scope**
- Voice notes
- Rich-text formatting in reason/description fields
- Multiple attachments per submission
- SMS/email digest (daily rollup) — only per-event channel fan-out
- Tiered review / escalation
- A unified "parent requests" admin queue across workflows (they're audience-specific)

## 3. Architecture

**Approach: split by concern.** A new `src/modules/parent-requests/` module with:
- `eligibility.ts` — pure functions (date-range, window, reviewer eligibility)
- `notifications.ts` — fan-out wrapper over existing `sendMessage`
- `lifecycle.ts` — `cancelPendingRequestsForStudent` helper
- `actions/excuse.action.ts` — excuse CRUD + review
- `actions/medical-disclosure.action.ts` — disclosure CRUD + review
- `actions/attachment.action.ts` — signed URL generators scoped to parent-requests

Attachments reuse `src/modules/messaging/attachments.ts` (`validateAttachment`, `buildAttachmentKey`, `ALLOWED_MIME_TYPES`, `MAX_ATTACHMENT_SIZE_BYTES`). A small new component `src/components/portal/attachment-upload.tsx` is factored out of the messaging new-conversation modal so both modules share the upload UX.

**No workflow engine.** The exeat flow uses the workflow engine for its 5-state machine. `PENDING → APPROVED | REJECTED | WITHDRAWN` is a 4-state enum on the row — a plain status column is simpler to test, debug, and evolve.

Data invariants (submitter is a household guardian; reviewer is the active class teacher / housemaster for the student) are enforced at the action layer, mirroring the messaging approach.

## 4. Data Model

```prisma
// Appended to prisma/schema/attendance.prisma

model ExcuseRequest {
  id                String              @id @default(cuid())
  schoolId          String
  studentId         String
  submittedByUserId String
  fromDate          DateTime
  toDate            DateTime
  reason            String
  attachmentKey     String?
  attachmentName    String?
  attachmentSize    Int?
  attachmentMime    String?
  status            ExcuseRequestStatus @default(PENDING)
  reviewerUserId    String?
  reviewNote        String?
  reviewedAt        DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  school      School  @relation("SchoolExcuseRequest", fields: [schoolId], references: [id])
  student     Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  submittedBy User    @relation("SubmittedExcuses", fields: [submittedByUserId], references: [id])
  reviewer    User?   @relation("ReviewedExcuses", fields: [reviewerUserId], references: [id], onDelete: SetNull)

  @@index([schoolId, status])
  @@index([studentId, status])
  @@index([submittedByUserId])
  @@index([fromDate, toDate])
}

enum ExcuseRequestStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}

// Appended to prisma/schema/student.prisma

model MedicalDisclosure {
  id                       String                    @id @default(cuid())
  schoolId                 String
  studentId                String
  submittedByUserId        String
  category                 MedicalDisclosureCategory
  title                    String
  description              String
  isUrgent                 Boolean                   @default(false)
  attachmentKey            String?
  attachmentName           String?
  attachmentSize           Int?
  attachmentMime           String?
  status                   MedicalDisclosureStatus   @default(PENDING)
  reviewerUserId           String?
  reviewNote               String?
  reviewedAt               DateTime?
  resultingMedicalRecordId String?
  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt

  school      School  @relation("SchoolMedicalDisclosure", fields: [schoolId], references: [id])
  student     Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  submittedBy User    @relation("SubmittedDisclosures", fields: [submittedByUserId], references: [id])
  reviewer    User?   @relation("ReviewedDisclosures", fields: [reviewerUserId], references: [id], onDelete: SetNull)

  @@index([schoolId, status])
  @@index([schoolId, status, isUrgent])
  @@index([studentId, status])
  @@index([submittedByUserId])
}

enum MedicalDisclosureCategory {
  ALLERGY
  CONDITION
  MEDICATION
}

enum MedicalDisclosureStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}
```

**Key choices:**
- `onDelete: Cascade` on `studentId` matches existing attendance/medical FK policy.
- `onDelete: SetNull` on `reviewerUserId` preserves audit trail if a staff account is later deleted.
- No `AttendanceRecord[]` link on `ExcuseRequest` — approval resolves records by `(studentId, date in [fromDate, toDate], status in ABSENT/LATE/SICK)` at apply-time, which correctly handles registers marked after the parent submitted.
- `resultingMedicalRecordId` back-links to the record created on approval for audit.
- No soft-delete; retention sweeps terminal rows at 7 years.

Migration: one schema change with the two models + enums, plus back-relation additions on `Student`, `School`, `User`.

## 5. State Machines

Both workflows share a 4-state enum; all non-PENDING states are terminal. Transitions are enforced at the action layer.

### ExcuseRequest transitions

| From | To | Triggered by | Effect |
|---|---|---|---|
| PENDING | APPROVED | reviewer (class_teacher or housemaster) | Flip every `AttendanceRecord` in `[fromDate, toDate]` with `status in (ABSENT, LATE, SICK)` to `EXCUSED`; stamp `remarks` with `"Excused per request {id}"` if blank. Notify parent. |
| PENDING | REJECTED | reviewer | Attendance untouched. `reviewNote` required. Notify parent with reason. |
| PENDING | WITHDRAWN | submitter | Attendance untouched. No reviewer notification. |
| terminal | * | nobody | Parent must submit a new request. |

### MedicalDisclosure transitions

| From | To | Triggered by | Effect |
|---|---|---|---|
| PENDING | APPROVED | reviewer (school_nurse) | Create a `MedicalRecord` row (`type = category`, `title`, `description`, `attachmentKey`, `recordedBy = nurse.userId`, `isConfidential = false`); store its id in `resultingMedicalRecordId`. Optional sync step — nurse can append to `Student.allergies` / `Student.medicalConditions`. Notify parent. |
| PENDING | REJECTED | reviewer | No MedicalRecord. `reviewNote` required. Notify parent. |
| PENDING | WITHDRAWN | submitter | Silent. |
| terminal | * | nobody | Parent submits a new request. |

### Invariants

- Approval is atomic — `$transaction` wraps the status update + side effects + audit.
- `reviewNote` required (non-empty) on REJECT in both flows.
- Approve/reject is idempotent: re-calling on a terminal row returns `{ error: "Already reviewed" }`.
- Overlapping excuses allowed. Flipping an already-EXCUSED row is a no-op.
- Reviewer eligibility is re-checked at action time (per-request domain rule — not a permission). A class teacher who rotated off the arm between submission and review is rejected with a clear error.
- Nurse approval has no per-student scoping — nurses are school-wide within their school.

## 6. Permissions

New constants in `src/lib/permissions.ts`, after the `MESSAGING_*` block:

```ts
EXCUSE_SUBMIT:             "parent_requests:excuse:submit",
EXCUSE_REVIEW:             "parent_requests:excuse:review",
MEDICAL_DISCLOSURE_SUBMIT: "parent_requests:medical:submit",
MEDICAL_DISCLOSURE_REVIEW: "parent_requests:medical:review",
```

Grants:

| Permission | Granted to |
|---|---|
| `EXCUSE_SUBMIT` | `parent` |
| `EXCUSE_REVIEW` | `class_teacher`, `housemaster` |
| `MEDICAL_DISCLOSURE_SUBMIT` | `parent` |
| `MEDICAL_DISCLOSURE_REVIEW` | `school_nurse` |

`super_admin` inherits all via `ALL_PERMISSIONS`.

No `PARENT_REQUESTS_ADMIN_READ` permission ships in MVP — if an admin needs to see requests they can query audit logs or use super_admin. If this turns out to be wrong we add it in a follow-up.

## 7. Pure Eligibility Helpers

`src/modules/parent-requests/eligibility.ts` — no DB, no side effects:

```ts
export function isWithinRetroactiveWindow(
  fromDate: Date,
  now?: Date,
  windowDays?: number,
): boolean;

export function isValidDateRange(fromDate: Date, toDate: Date): boolean;

export function canReviewExcuse(
  reviewer: StaffAssignment,
  student: StudentContext,
): boolean;
```

Reuses `StudentContext` + `StaffAssignment` types from the messaging module (`@/modules/messaging/eligibility`) — rather than re-defining.

Rules:
- Retroactive window default: 14 days. Future dates (fromDate > now) are never valid.
- Valid date range: `fromDate <= toDate`, neither in the future, both within the retroactive window.
- Reviewer eligibility reuses the messaging `eligibleStaffRole` logic. A reviewer can approve/reject an excuse iff they'd be an eligible messaging counterpart for that student.

## 8. Server Actions

All paths under `src/modules/parent-requests/actions/`.

### `excuse.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `submitExcuseRequestAction({ studentId, fromDate, toDate, reason, attachmentKey?, attachmentName?, attachmentSize?, attachmentMime? })` | `EXCUSE_SUBMIT` | Validates guardian + student status + window + reason + attachment. Creates `ExcuseRequest { PENDING }`. Triggers `notifyExcuseSubmitted` to class_teacher (+ housemaster for boarders). |
| `withdrawExcuseRequestAction(requestId)` | `EXCUSE_SUBMIT` | Submitter-only, PENDING-only. Status → WITHDRAWN. |
| `getMyExcuseRequestsAction({ status? })` | `EXCUSE_SUBMIT` | Parent's own submissions. |
| `getPendingExcuseRequestsAction({ studentId? })` | `EXCUSE_REVIEW` | Scoped to students the caller can review (arm for class_teacher, house for housemaster, BOARDING only). |
| `getExcuseRequestAction(requestId)` | submitter OR eligible reviewer | Detail view. |
| `approveExcuseRequestAction({ requestId, reviewNote? })` | `EXCUSE_REVIEW` | Re-checks eligibility. In `$transaction`: status → APPROVED, stamp reviewer/reviewedAt, flip matching AttendanceRecord rows, audit. Post-tx: notify parent. |
| `rejectExcuseRequestAction({ requestId, reviewNote })` | `EXCUSE_REVIEW` | Non-empty note required. Status → REJECTED. Audit. Notify parent. |

### `medical-disclosure.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `submitMedicalDisclosureAction({ studentId, category, title, description, isUrgent?, attachmentKey?, ... })` | `MEDICAL_DISCLOSURE_SUBMIT` | Validates guardian + category + fields + attachment. Creates `MedicalDisclosure { PENDING }`. Urgent submissions fan out IN_APP + SMS; routine IN_APP only. |
| `withdrawMedicalDisclosureAction(disclosureId)` | `MEDICAL_DISCLOSURE_SUBMIT` | Submitter-only, PENDING-only. |
| `getMyMedicalDisclosuresAction({ status? })` | `MEDICAL_DISCLOSURE_SUBMIT` | Parent's own submissions. |
| `getPendingMedicalDisclosuresAction({ urgent? })` | `MEDICAL_DISCLOSURE_REVIEW` | All PENDING rows in school. Urgent-first sort. |
| `getMedicalDisclosureAction(disclosureId)` | submitter OR `MEDICAL_DISCLOSURE_REVIEW` | Detail view. |
| `approveMedicalDisclosureAction({ disclosureId, reviewNote?, syncToStudent?: { allergies?: string, conditions?: string } })` | `MEDICAL_DISCLOSURE_REVIEW` | In `$transaction`: create MedicalRecord, set `resultingMedicalRecordId`, status → APPROVED, optional sync to denormalized Student fields (dedup + semicolon-separated append). Audit. Notify parent. |
| `rejectMedicalDisclosureAction({ disclosureId, reviewNote })` | `MEDICAL_DISCLOSURE_REVIEW` | Non-empty note required. Status → REJECTED. Audit. Notify parent. |

### `attachment.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `getParentRequestAttachmentUploadUrlAction({ kind: "excuse" \| "medical", filename, mimeType, size })` | `EXCUSE_SUBMIT` or `MEDICAL_DISCLOSURE_SUBMIT` | Validates via messaging helpers. R2 presign with `maxSizeBytes` binding, 300s expiry. Key prefix: `parent-requests/{schoolId}/{uuid}-{filename}`. |
| `getParentRequestAttachmentUrlAction({ kind, requestId })` | submitter OR appropriate reviewer permission + eligibility | 5-minute signed GET URL. |

### Integration hooks (modifications)

- `src/modules/student/actions/transfer.action.ts` — `transferStudentAction`, `withdrawStudentAction`: call `cancelPendingRequestsForStudent` after audit, wrapped in try/catch.
- `src/modules/student/actions/student.action.ts` — `deleteStudentAction`: same.
- `src/modules/student/actions/promotion.action.ts` — `commitPromotionRunAction` GRADUATE/WITHDRAW outcomes: same.
- `src/modules/academics/actions/promotion.action.ts` — GRADUATED branch: same.

## 9. Notifications

Four new event keys in `src/lib/notifications/events.ts`:

```ts
EXCUSE_REQUEST_SUBMITTED:     "excuse_request_submitted",
EXCUSE_REQUEST_REVIEWED:      "excuse_request_reviewed",
MEDICAL_DISCLOSURE_SUBMITTED: "medical_disclosure_submitted",
MEDICAL_DISCLOSURE_REVIEWED:  "medical_disclosure_reviewed",
```

**`EVENT_CHANNELS` defaults:**

| Event | Defaults |
|---|---|
| `EXCUSE_REQUEST_SUBMITTED` | `[IN_APP]` |
| `EXCUSE_REQUEST_REVIEWED` | `[IN_APP, EMAIL]` |
| `MEDICAL_DISCLOSURE_SUBMITTED` | `[IN_APP]` for routine; `[IN_APP, SMS]` when `isUrgent` — resolved at fan-out time |
| `MEDICAL_DISCLOSURE_REVIEWED` | `[IN_APP, EMAIL]` |

Users override via the existing notification-preferences surface — adding the events to the registry makes them render there (matches how messaging events did it).

`src/modules/parent-requests/notifications.ts` exports:

```ts
export async function notifyExcuseSubmitted(params: {
  requestId: string;
  reviewerUserIds: string[];
  studentName: string;
  fromDate: Date;
  toDate: Date;
  submitterName: string;
}): Promise<void>;

export async function notifyExcuseReviewed(params: {
  requestId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void>;

export async function notifyMedicalDisclosureSubmitted(params: {
  disclosureId: string;
  nurseUserIds: string[];
  studentName: string;
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  isUrgent: boolean;
  submitterName: string;
}): Promise<void>;

export async function notifyMedicalDisclosureReviewed(params: {
  disclosureId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void>;
```

Each resolves per-recipient `NotificationPreference`, falls back to the registry default, swallows per-recipient errors. Urgent medical messages carry a `[URGENT]` prefix in the body.

**Recipient resolution** happens inside each action:
- Excuse submit → class teacher + housemaster via Staff→User lookup (same shape as `getEligibleCounterpartsAction` in messaging).
- Medical submit → `db.userRole.findMany({ where: { schoolId, role: { name: "school_nurse" } } })` → distinct User ids.
- Review actions → `{ submitterUserId: request.submittedByUserId }`.

## 10. Attachments

Reuses the messaging attachment module wholesale:
- MIME allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/webp`
- Max size: 5 MB
- Key format: `parent-requests/{schoolId}/{uuid}-{sanitizedFilename}` — distinct prefix so retention sweeps can target only parent-requests objects.
- Upload flow: client requests signed PUT URL → PUTs to R2 → client calls the submit action → server HEAD-verifies the object (ContentLength within cap, MIME matches claim) → persists or rejects + deletes orphan.
- Download flow: 5-minute signed GET URL.

Imports `validateAttachment`, `buildAttachmentKey`, `ALLOWED_MIME_TYPES`, `MAX_ATTACHMENT_SIZE_BYTES` from `@/modules/messaging/attachments`. The `buildAttachmentKey` helper is parameterized on prefix — we pass `"parent-requests"` instead of `"messages"`. Minor refactor: change `buildAttachmentKey` to accept an optional `prefix` parameter defaulting to `"messages"` (backwards compatible). If that's awkward, add a sibling `buildParentRequestAttachmentKey` in the parent-requests module.

## 11. UI Surfaces

### Parent portal — `/parent/requests` (new)

Unified "My requests" hub with two tabs: **Excuses** and **Medical disclosures**. Each tab lists the parent's own submissions with status badge, date, child, short summary. Row click → detail drawer with full text, review note (if reviewed), attachment download, and (for PENDING rows) "Withdraw".

Two "+ New" buttons above the tabs:
- **+ Excuse an absence** modal: child picker (parent's students scoped to ACTIVE/SUSPENDED), date range picker (clamped to last 14 days, max `toDate = today`), reason textarea, optional attachment. Submit → `submitExcuseRequestAction`.
- **+ Disclose medical info** modal: child picker, category radio (Allergy/Condition/Medication), title input, description textarea, urgency checkbox, optional attachment.

Both modals use a shared `PortalAttachmentUpload` component factored from the messaging new-conversation modal into `src/components/portal/attachment-upload.tsx`.

Nav: add `{ href: "/parent/requests", label: "My requests" }` to `parentLinks`.

### Staff portal — `/staff/excuse-reviews` (new)

Inbox-style page for class teachers and housemasters. PENDING excuse requests scoped to students the caller can review. Row: student, date range, submitter, Review action → drawer with full detail + **Approve** / **Reject** buttons (reject requires inline note). After action, row disappears; toast confirms.

Empty state: "No pending excuse requests." Footer: "You review excuses for students in your class arm / boarding house."

Nav: add `{ href: "/staff/excuse-reviews", label: "Excuse reviews" }` to `staffLinks`.

### Dashboard — `/students/medical-disclosures` (new)

Nurse review page. Two sections:
- **Urgent** (isUrgent = true, PENDING) pinned at top with red indicator.
- **Routine** (isUrgent = false, PENDING) newest first.
- Toggle to include resolved rows for audit browsing.

Row drawer: full category/title/description/attachment + two-step approval:
1. **Approve** → sub-modal with category-driven optional sync form:
   - ALLERGY → shows "Append to allergies" field (pre-filled with title)
   - CONDITION → shows "Append to medical conditions" field
   - MEDICATION → no sync (record only)
   - Nurse can uncheck to skip sync
2. **Reject** → inline note + reject.

Route under `(dashboard)/students/` for proximity to existing medical records. Add a sidebar link matching the messaging-admin pattern.

### Shared UX conventions

- Status badges: gray=PENDING, green=APPROVED, red=REJECTED, amber=WITHDRAWN.
- Attachments: paperclip + filename + size (KB). Click → signed GET URL, opens with `noopener,noreferrer`.
- Dates via `toLocaleDateString()` consistent with attendance page.
- Toasts via `sonner`.

## 12. Lifecycle + Retention

### Lifecycle hooks

`src/modules/parent-requests/lifecycle.ts`:

```ts
export async function cancelPendingRequestsForStudent(studentId: string): Promise<void>;
```

Transactionally marks all PENDING `ExcuseRequest` + `MedicalDisclosure` rows for the student → WITHDRAWN with a system-generated `reviewNote = "Auto-cancelled: student {status}"`. No reviewer set.

Wired from four call sites (same pattern as messaging archive):
- `transferStudentAction`, `withdrawStudentAction` (transfer.action.ts) after TRANSFERRED / WITHDRAWN
- `deleteStudentAction` (student.action.ts) after WITHDRAWN
- `commitPromotionRunAction` (promotion.action.ts) GRADUATE / WITHDRAW outcomes
- Academics `processPromotionsAction` GRADUATED branch

Each call is wrapped in `try/catch` that logs and continues — best-effort post-audit.

APPROVED/REJECTED rows untouched — they're audit records.

### Retention

7 years, matches messaging. Add to the existing retention worker:
- `ExcuseRequest` with `resolvedAt < now - 7y` → delete R2 attachment key, then delete row.
- `MedicalDisclosure` same.
- The `MedicalRecord` created on approval is governed by its own retention policy (permanent until grad + 10 years) — separate concern.

### R2 cleanup

WITHDRAWN / REJECTED submissions keep their attachment until retention sweeps them. Rationale: review notes may reference the attachment, and the cost is negligible. Only approved-path retention deletes objects early.

## 13. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Non-guardian parent submits for a student not in household | Rejected by eligibility check; `{ error: "You are not authorized to submit for this student." }` |
| Date range includes future dates | Rejected; forward-dated requests belong in the exeat flow |
| Date range > 14 days old | Rejected with a clear window-citation error |
| `fromDate > toDate` | Rejected |
| Parent submits a second overlapping excuse while first PENDING | Allowed. Second approval is a no-op on already-EXCUSED rows |
| Parent withdraws after reviewer opened detail but before they acted | Reviewer's next action returns `{ error: "Already reviewed" }`; UI refreshes the list |
| Reviewer loses eligibility mid-stream (teacher rotation between submission and review) | `approve*`/`reject*` re-check at action time; rejected with `{ error: "You're no longer assigned to this student's arm/house." }`. New eligible teacher picks up from their queue |
| Attachment MIME mismatch vs. claimed | Rejected at R2 HEAD step; orphan key deleted |
| Attachment >5 MB | ContentLength-bound signed URL rejects at upload; HEAD step also re-verifies |
| Nurse approves with sync to allergies; value already present verbatim | Dedup: normalize whitespace/semicolons, split, skip exact matches, append only new tokens |
| Nurse approves without sync | MedicalRecord created; student denormalized fields untouched |
| Two nurses approve concurrently | First wins (status check inside transaction); second returns `"Already reviewed"` |
| Parent deletes attachment from R2 externally | Signed GET 404s; UI toasts "Attachment unavailable". Submission still usable |
| Lifecycle cancellation fires after reviewer already approved | No-op: helper only touches PENDING |
| `notifyExcuseSubmitted` throws (hub down) | Swallowed per-recipient; submission persists |
| Tenant isolation | Every query carries `schoolId`; R2 keys scoped `parent-requests/{schoolId}/...` |
| GDPR user deletion | FKs `SetNull` on reviewer; UI displays "(deleted user)" |
| Audit write failure | Best-effort 3-retry from the existing helper; action continues |
| Approval tries to flip an AttendanceRecord that doesn't exist yet | Silent skip; parent submits again if needed. Documented limitation — no retroactive auto-apply |
| Reviewer note contains emoji / non-ASCII | Stored as UTF-8; no length enforced beyond DB `text` cap. Front-end suggests 2000 chars max |

## 14. Testing Strategy

### Pure helpers — `tests/unit/modules/parent-requests/eligibility.test.ts` (~10)
- `isWithinRetroactiveWindow`: today, 14d boundary, 15d rejected, future rejected, null/undefined
- `isValidDateRange`: equal ok, reversed rejected, future toDate rejected
- `canReviewExcuse`: class_teacher of arm ✓, different arm ✗, housemaster + BOARDING ✓, housemaster + DAY ✗, not ACTIVE/SUSPENDED ✗

### Actions with Prisma mock
- `excuse.test.ts` (~14) — permission gates, tenant isolation, all rejections, notify fan-out trigger, attendance flip, eligibility re-check, reject requires note, idempotency
- `medical-disclosure.test.ts` (~12) — same gates, urgent vs routine notify, approve creates MedicalRecord + optional sync dedup, reject requires note, concurrent approve
- `notifications.test.ts` (~5) — pref lookup, default fallback, opt-out, urgent channel override, error swallowing
- `lifecycle.test.ts` (~3) — PENDING flip on both workflows, terminal rows untouched, system note stamped

### Integration — `tests/integration/students/parent-requests.test.ts` (~6, live DB)
- Happy path excuse: submit → approve → AttendanceRecord flips
- Happy path medical: urgent allergy → nurse approves with sync → Student.allergies appended + MedicalRecord exists
- Rejection notifies parent with reason (NotificationMessage row asserted)
- Withdrawal removes from reviewer queue
- Lifecycle: graduation cancels pending
- Tenant isolation across both flows

### Guardrails
- `audit-coverage.test.ts`: approve/reject/withdraw carry `audit()`; `submit*`, list/get actions carry `@no-audit` JSDoc
- `permissions.test.ts`: 4 new permissions exist + granted to expected roles, NOT granted to unrelated roles

**Net-new tests:** ~55.

## 15. Verification Plan

1. `npx vitest run` — all unit tests pass
2. `npm run test:students` — integration suite including new `parent-requests.test.ts`
3. `npx vitest run tests/unit/guardrails/audit-coverage.test.ts` — passing
4. `npx tsc --noEmit` — clean
5. `npm run build` — success; confirm new routes compile:
   - `/parent/requests`
   - `/staff/excuse-reviews`
   - `/students/medical-disclosures`
6. `npm run lint` — 0 errors, no new baseline warnings
7. `npx prisma migrate dev --name add_parent_requests_models` — applies cleanly
8. `npx prisma migrate status` — DB up to date
9. Manual UI walk:
   - Parent creates excuse with attachment → class teacher approves → AttendanceRecord flips to EXCUSED
   - Parent creates urgent medical disclosure → nurse sees urgent queue → approves with sync → `Student.allergies` appended + MedicalRecord exists
   - Rejection with note shows in parent's `/parent/requests`
   - Parent withdraws PENDING request → reviewer queue updates
   - Student graduation → pending requests auto-WITHDRAWN

## 16. Critical Files

**New**
- `prisma/schema/attendance.prisma` — append `ExcuseRequest` + enum + back-relations
- `prisma/schema/student.prisma` — append `MedicalDisclosure` + enums + back-relations (and `resultingMedicalRecordId` nullable linkage)
- `prisma/schema/migrations/<timestamp>_add_parent_requests_models/migration.sql`
- `src/modules/parent-requests/eligibility.ts`
- `src/modules/parent-requests/notifications.ts`
- `src/modules/parent-requests/lifecycle.ts`
- `src/modules/parent-requests/actions/excuse.action.ts`
- `src/modules/parent-requests/actions/medical-disclosure.action.ts`
- `src/modules/parent-requests/actions/attachment.action.ts`
- `src/components/portal/attachment-upload.tsx` — factored from NewConversationModal
- `src/app/(portal)/parent/requests/page.tsx` + client
- `src/app/(portal)/parent/requests/new-excuse-modal.tsx`
- `src/app/(portal)/parent/requests/new-medical-modal.tsx`
- `src/app/(portal)/staff/excuse-reviews/page.tsx` + client
- `src/app/(dashboard)/students/medical-disclosures/page.tsx` + client
- Tests enumerated in §14

**Modified**
- `src/lib/permissions.ts` — 4 new permissions + grants
- `src/lib/notifications/events.ts` — 4 new event keys + EVENT_CHANNELS entries
- `src/app/(portal)/portal-nav.tsx` — `My requests` on parent, `Excuse reviews` on staff
- `src/app/(dashboard)/students/` sidebar — add `Medical Disclosures` link
- `src/modules/student/actions/transfer.action.ts` — call `cancelPendingRequestsForStudent` (both transfer + withdraw paths)
- `src/modules/student/actions/student.action.ts` — same in `deleteStudentAction`
- `src/modules/student/actions/promotion.action.ts` — GRADUATE/WITHDRAW outcomes
- `src/modules/academics/actions/promotion.action.ts` — GRADUATED branch
- `src/workers/retention.worker.ts` — add 2 new tables to the sweep
- `src/modules/messaging/attachments.ts` — optional `prefix` parameter on `buildAttachmentKey` (default `"messages"` for backward compat)
- Back-relation additions on `Student`, `School`, `User` in their Prisma files
