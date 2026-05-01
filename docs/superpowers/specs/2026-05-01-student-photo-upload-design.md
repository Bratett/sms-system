# Student Photo Upload + Cropper + Webcam

**Date:** 2026-05-01
**Tier 3 #11** of the Students-module feature-depth review.

**Depends on:** existing R2 storage layer (`src/lib/storage/r2.ts`), photo resolver (`src/modules/student/actions/photo.ts`), upload route (`src/app/api/upload/route.ts`), `Student.photoUrl` field (currently dormant in profile UI). One small storage helper (`getObject`) will be added to `r2.ts` — see §4.6.

## 1. Summary

Wires the dormant `Student.photoUrl` field into the student profile. Users with `STUDENT_UPDATE` click the avatar circle on a profile to open a modal that accepts either a file upload OR a webcam capture, runs the result through a square (1:1) cropper, then writes the cropped+normalized image to R2 and stores the R2 key in `Student.photoUrl`. The existing photo resolver is updated to detect whether `photoUrl` holds a key or a full URL and signs keys at read time.

The same avatar component renders the photo when present and falls back to initials when absent. Photo upload is a **post-creation** action — it does not appear on the create-student form.

## 2. Goals & non-goals

**Goals**
- Click-the-avatar UX on the student profile opens a photo upload modal (only for users with `STUDENT_UPDATE`).
- Modal supports two input methods: file picker (drag-drop or click) and webcam capture.
- Both inputs feed a shared cropper locked to a 1:1 aspect ratio.
- Reject files >5 MB, non-image MIME types, or images smaller than 300×300 before letting the user crop.
- Server-side: download the user-uploaded blob from R2, resize the cropped result to 800×800 max JPEG (q85) via `sharp`, write to a stable R2 key `students/<studentId>/photo.jpg`, store that key in `Student.photoUrl`, audit.
- Avatar everywhere (profile, ID card, future use sites) uses a single `<PhotoAvatar>` component that renders the resolved image or initials fallback.
- Existing `resolveStudentPhotoUrl` continues to work for legacy data (full URLs in `photoUrl`) and new data (R2 keys in `photoUrl`) via a heuristic.

**Non-goals**
- Photo gallery / multiple photos per student (one current photo at a time).
- Background removal, face detection, or auto-crop.
- Bulk photo import (registration desk batch).
- Photo on guardian or staff records.
- Photo upload during student creation (`students/new/student-form.tsx`) — deferred per user decision; users land on the profile after creation and upload there.
- Public/CDN delivery of photos — all reads go through `getSignedDownloadUrl` (signed URLs with expiry).
- Cache-busting query parameters — signed URLs include a fresh signature on every request, so the browser sees a new URL on each render and cache invalidates naturally within a session.
- Maintaining a delete step for previous photos — the stable-key strategy (`students/<id>/photo.jpg`) overwrites on PUT, achieving the same end state as "delete old object" without an explicit delete call.

## 3. User decisions (recorded from brainstorming)

| Q | Decision |
|---|---|
| Q1 — Cropper | B — square 1:1 with 300×300 minimum-dimensions client-side validation |
| Q2 — Webcam | A — in scope (use `react-webcam`) |
| Q3 — UI placement | i — click-the-avatar (avatar becomes the upload trigger) |
| Q3 — Replacement strategy | A — old object replaced (achieved via stable-key PUT, functionally equivalent to "delete old") |
| Defaults — upload | reuse `POST /api/upload`; JPEG/PNG/WebP only; ≤5 MB pre-crop; server normalizes to 800×800 JPEG q85 |
| Defaults — libraries | `react-easy-crop` (cropper), `react-webcam` (capture), `sharp` (server resize) |
| Defaults — permission | `STUDENT_UPDATE` (existing) |
| Create form | photo upload not added to create-student form; users land on profile and upload there |

## 4. Architecture

### 4.1 New module surface

```
src/modules/student/actions/
  photo.ts                   ← MODIFY: update resolver to detect key vs URL
  photo-upload.ts            ← NEW: setStudentPhotoAction, removeStudentPhotoAction

src/components/students/
  photo-avatar.tsx           ← NEW: clickable avatar (opens uploader); fallback to initials
  photo-uploader.tsx         ← NEW: modal — file/webcam tabs + cropper

tests/unit/student/
  photo-upload.test.ts       ← NEW

package.json
  +deps: react-easy-crop, react-webcam, sharp
```

### 4.2 Server actions (in `photo-upload.ts`)

#### `setStudentPhotoAction({ studentId, fileKey })`

`fileKey` is the R2 key returned by `POST /api/upload` (the existing endpoint that uploaded the cropped blob).

Behavior:
1. `requireSchoolContext` + `assertPermission(STUDENT_UPDATE)`.
2. Verify the student belongs to the caller's school; if not, return `{ error: "Student not found" }`.
3. Download the temporary upload via `getObject(fileKey)` (server reads the buffer from R2).
4. Resize to 800×800 max (cover, square) JPEG q85 via `sharp`.
5. Upload the normalized buffer to the stable key `students/<studentId>/photo.jpg` via `uploadFile`.
6. Update `Student.photoUrl = "students/<studentId>/photo.jpg"` (we store the **key**, not a URL).
7. Delete the temporary upload object from R2 (best-effort; log failure).
8. Audit: `action: "UPDATE", entity: "Student", entityId: studentId, module: "student", description: "Updated student photo"`.
9. Return `{ data: { photoKey: "students/<studentId>/photo.jpg" } }`.

#### `removeStudentPhotoAction({ studentId })`

1. `requireSchoolContext` + `assertPermission(STUDENT_UPDATE)`.
2. School-scope verify the student.
3. If `Student.photoUrl` is null → return success no-op.
4. If the stored value looks like a key (no scheme), delete that R2 object (best-effort).
5. Set `Student.photoUrl = null`.
6. Audit: `action: "UPDATE", entity: "Student", entityId: studentId, description: "Removed student photo"`.
7. Return `{ data: { ok: true } }`.

### 4.3 Resolver change (in `photo.ts`)

Current line 28: `if (student.photoUrl) return student.photoUrl;`

Replace with:

```typescript
if (student.photoUrl) {
  // photoUrl may hold either a legacy full URL or an R2 key (new uploads)
  if (student.photoUrl.startsWith("http")) return student.photoUrl;
  return await getSignedDownloadUrl(student.photoUrl);
}
```

This preserves backward-compatibility with any existing rows that hold a real URL while supporting the new key-storage approach.

### 4.4 UI components

#### `<PhotoAvatar>` (`photo-avatar.tsx`)

Props:
```typescript
{
  studentId: string;
  photoSrc: string | null;   // resolved URL (signed) or null
  fallbackInitials: string;  // e.g., "AM"
  canEdit: boolean;
  size?: "sm" | "md" | "lg"; // default md (h-24 w-24)
  onPhotoChanged?: (newPhotoSrc: string | null) => void; // parent refreshes after upload
}
```

Behavior:
- When `photoSrc` is set, render `<img>` (square, rounded-full).
- When null, render initials in a muted background div (matches current placeholder).
- When `canEdit && photoSrc` → click overlays an edit hint and opens the uploader modal.
- When `canEdit && !photoSrc` → the initials block itself is clickable; opens the uploader.
- When `!canEdit` → not clickable; just renders.

#### `<PhotoUploader>` (`photo-uploader.tsx`)

Props:
```typescript
{
  studentId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (newPhotoSrc: string) => void;
}
```

Behavior — modal with two tabs ("Upload file" / "Use webcam") and a shared cropper view:

- **Upload file tab**: drag-drop zone + `<input type="file" accept="image/jpeg,image/png,image/webp">`. Reads file, validates MIME, validates size ≤5 MB, validates dimensions ≥300×300 (via temporary `<img>` load). On success, jumps to cropper.
- **Webcam tab**: `<Webcam>` from `react-webcam` previews user-facing camera. "Capture" button takes a still frame as a Blob. Validates same dimension/size rules. Jumps to cropper. If user denies camera permission, show "Camera unavailable — please use the upload tab".
- **Cropper view** (`react-easy-crop`): shows the source image with a 1:1 crop box, zoom slider, drag-to-reposition. "Use this photo" button: extracts cropped Blob via Canvas drawing (using the cropper's `croppedAreaPixels` callback to determine the crop region), POSTs it to `/api/upload` as `multipart/form-data` with `file`, `module=student-photo`, and `entityId=<studentId>` (the existing route generates a temporary key under `student-photo/<studentId>/<filename>`), then calls `setStudentPhotoAction({ studentId, fileKey })`. On success calls `onSuccess(newPhotoSrc)` and closes the modal. "Back" returns to the tab without uploading.
- **Remove-photo control**: when a photo currently exists (`photoSrc` is non-null), the modal footer shows a destructive "Remove photo" button alongside the "Use this photo" button. Clicking opens an inline confirm-prompt within the modal ("Remove this photo?" / "Cancel" / "Remove"). On confirm: call `removeStudentPhotoAction({ studentId })`, fire `onSuccess(null)` (parent treats null as "fall back to initials"), close modal.
- Errors: inline error text in the relevant view (don't close modal on error; keep state).

### 4.5 Profile wiring

In `src/app/(dashboard)/students/[id]/page.tsx`:
- Compute `canEditStudent = perms.includes("*") || perms.includes(PERMISSIONS.STUDENT_UPDATE)`.
- Resolve the photo source at the server: call `resolveStudentPhotoUrl(student.id)` once and pass `photoSrc` to the profile.
- Pass both to `<StudentProfile>`.

In `src/app/(dashboard)/students/[id]/student-profile.tsx`:
- Accept new props `photoSrc: string | null` and `canEditStudent: boolean`.
- Replace the existing initials `<div>` (lines 393–397) with `<PhotoAvatar studentId={student.id} photoSrc={photoSrc} fallbackInitials={...} canEdit={canEditStudent} size="lg" onPhotoChanged={(src) => router.refresh()} />`.

(Resolving the photo at the server avoids exposing the resolver to the client and means the page renders with the correct image on first paint.)

### 4.6 Storage helper addition

`src/lib/storage/r2.ts` currently exports `uploadFile`, `getSignedDownloadUrl`, `getSignedUploadUrl`, `headObject`, `deleteFile`, and `generateFileKey`. To support the server-side resize pipeline, add a `getObject` helper:

```typescript
export async function getObject(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  const response = await r2Client.send(command);
  if (!response.Body) throw new Error(`No body returned for key ${key}`);
  // SDK returns a Readable stream in Node; collect into a Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

Mirror the import/export style of `headObject` (already in the file). This is a small, additive change — no existing exports are modified.

## 5. Permissions

- Action gate: `assertPermission(ctx.session, PERMISSIONS.STUDENT_UPDATE)`. Existing key — no new permission introduced.
- UI gate: page-level `canEditStudent` boolean threaded into `<PhotoAvatar>`. Click is no-op when false.
- Resolver permission unchanged (already school-scoped).

## 6. Storage strategy

- Stable key: `students/<studentId>/photo.jpg`. PUT replaces; no orphans accumulate.
- Field stores the **key**, not a URL. Resolver signs at read time.
- Temporary upload (from `POST /api/upload`) lives at the default key the upload route generates; the action explicitly deletes it after copying the resized buffer to the stable key. This keeps the bucket clean.
- Signed URLs use the existing default expiry from `getSignedDownloadUrl` (~7 days). For pages that hold the URL longer than the expiry, the user just refreshes; we do not implement client-side re-signing.

## 7. Server-side image processing

- `sharp` is added to dependencies (Node-only; not bundled to the client).
- The resize pipeline: `sharp(buffer).rotate().resize({ width: 800, height: 800, fit: "cover", position: "centre" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()`.
- `.rotate()` honors EXIF orientation so phone photos taken in portrait don't end up sideways.
- The cropper has already produced a square at the client side, but the server still applies `fit: "cover"` as a safety net to guarantee the final asset is 800×800 even if the client sent a non-square blob (defense in depth).
- If `sharp` throws (corrupt image), the action returns `{ error: "Could not process image" }` and the temporary upload is still cleaned up.

## 8. Testing strategy

Unit tests in `tests/unit/student/photo-upload.test.ts`:

- `setStudentPhotoAction`:
  - Rejects unauthenticated callers
  - Rejects callers without `STUDENT_UPDATE`
  - Returns "Student not found" on cross-school access
  - Calls `sharp` resize, uploads to stable key, updates `Student.photoUrl` to the key, writes one audit row
  - Cleans up the temporary upload key on success
  - Cleans up the temporary upload key when sharp fails (via try/finally semantics or explicit cleanup)
- `removeStudentPhotoAction`:
  - Permission and school-scope tests
  - When `photoUrl` is null → success no-op (no R2 calls)
  - When `photoUrl` is a key → R2 delete called, field nulled, audit written
  - When `photoUrl` is a legacy URL → field nulled, but R2 delete NOT called (we don't own external URLs)

Resolver test (extension of any existing tests): when `photoUrl` is a key (no scheme), resolver calls `getSignedDownloadUrl` and returns the signed URL.

UI: smoke tested manually — modal flow, cropper interactions, webcam permission flows are exercised end-to-end in the browser per §10.

## 9. Edge cases captured

- Image too small (<300×300) → modal shows "Photo must be at least 300×300 pixels"; user retries.
- File too large (>5 MB) → "Photo must be 5 MB or smaller".
- Wrong MIME type → "Only JPEG, PNG, and WebP images are accepted".
- Webcam permission denied → fallback message, switch to upload tab.
- User closes modal mid-upload → AbortController cancels the fetch; partial uploads to R2 are cleaned up by the action's failure path (temporary key).
- Concurrent uploads (rapid click) → second click is debounced via the modal's submit-button disabled state during pending.
- Legacy data in `Student.photoUrl` (a full URL from before this PR) → resolver detects scheme prefix and returns as-is.
- EXIF orientation → `sharp.rotate()` normalizes so phone-portrait photos render upright.

## 10. Verification plan

1. `npm run dev`, log in as super_admin, navigate to a student profile.
2. Confirm the existing initials placeholder is replaced by `<PhotoAvatar>` (still showing initials before any upload).
3. Click the avatar → modal opens.
4. Switch to "Upload file" tab → drag a JPEG → cropper appears with a square crop box.
5. Pan and zoom; click "Use this photo".
6. Modal closes; profile re-renders with the new photo.
7. Reload page; photo persists (resolver signs the stored key).
8. Click avatar again → modal reopens. Switch to "Use webcam" → grant camera permission → "Capture" → cropper → upload. Confirm new photo persists.
9. Click avatar again, click "Remove photo" (destructive button in the modal footer when a photo currently exists) → inline confirm prompt → photo cleared, fallback initials reappear.
10. Open the rendered ID card PDF for that student → confirm the new photo is embedded (the existing ID card renderer uses `resolveStudentPhotoUrl`).
11. Log in as a teacher account (no `STUDENT_UPDATE`) → confirm the avatar renders the photo but is NOT clickable.
12. Run `npm test src/modules/student/__tests__/photo-upload.test.ts` — all green.

## 11. Out of scope (deferred)

- Multiple historical photos / photo timeline
- AI face-detection auto-crop
- Bulk photo import for registration days
- Direct photo upload during student create (requires storing the cropped Blob in form state and uploading after `createStudentAction` returns)
- Photo on guardian profiles
- CDN / public photo URLs (always signed)
- Photo audit log surfacing on the History tab — the audit row will already appear there via Tier 3 #10's cross-reference query (entity="Student", entityId=studentId), so no extra work needed for that integration
