# Student Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dormant `Student.photoUrl` field into a click-the-avatar uploader on the student profile, supporting file picker + webcam capture, a 1:1 cropper, server-side resize to 800×800 JPEG via `sharp`, and a stable R2 key per student. Update the existing photo resolver to detect key-vs-URL.

**Architecture:** One small storage helper (`getObject`) added to `src/lib/storage/r2.ts`. Two new server actions (`setStudentPhotoAction`, `removeStudentPhotoAction`) in `src/modules/student/actions/photo-upload.ts`. Two new client components: `<PhotoAvatar>` (clickable, fallback to initials) and `<PhotoUploader>` (modal with file/webcam tabs + cropper). The existing resolver `resolveStudentPhotoUrl` gets a one-line update to sign keys at read time. The student profile page resolves the photo at the server and threads `photoSrc` + `canEditStudent` props into the profile component which renders `<PhotoAvatar>` in place of the existing initials block.

**Tech Stack:** Next.js 15 App Router, Prisma 6.x, vitest + vitest-mock-extended, R2 (S3-compatible), `sharp` (server resize), `react-easy-crop` (cropper), `react-webcam` (capture).

**Spec reference:** [`docs/superpowers/specs/2026-05-01-student-photo-upload-design.md`](../specs/2026-05-01-student-photo-upload-design.md)

**Branch base:** `feat/student-photo-upload` (off `main`).

**Important corrections discovered while planning:**
- The permission key is `PERMISSIONS.STUDENTS_UPDATE` (plural "students"), value `"students:profile:update"`. The spec used `STUDENT_UPDATE` (singular) — that's wrong; use the plural form everywhere.
- The r2.ts module uses internal factories `getClient()` and `getBucket()` rather than module-level `r2Client` / `R2_BUCKET` constants. The new `getObject` helper must follow the same pattern.

---

## File Structure

**Created:**
- `src/modules/student/actions/photo-upload.ts` — `setStudentPhotoAction`, `removeStudentPhotoAction`
- `src/components/students/photo-avatar.tsx` — clickable avatar component
- `src/components/students/photo-uploader.tsx` — modal with file/webcam tabs + cropper
- `tests/unit/student/photo-upload.test.ts` — unit tests

**Modified:**
- `src/lib/storage/r2.ts` — add `getObject(key): Promise<Buffer>` helper
- `src/modules/student/actions/photo.ts` — update resolver line 28 to sign keys when `photoUrl` doesn't have an http scheme
- `src/app/(dashboard)/students/[id]/page.tsx` — compute `canEditStudent` from session perms; resolve photo at server
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — accept `photoSrc` and `canEditStudent` props; replace initials `<div>` with `<PhotoAvatar>`
- `package.json` — add `sharp`, `react-easy-crop`, `react-webcam` deps

---

## Task 0: Branch + dependencies + baseline

**Files:** `package.json` only

- [ ] **Step 1: Confirm worktree state**

```bash
cd ../sms-system-photo-upload && git status --short
```

Expected: working tree clean except possibly the untracked plan file (which we'll commit separately).

- [ ] **Step 2: Install new dependencies**

```bash
cd ../sms-system-photo-upload && npm install sharp react-easy-crop react-webcam 2>&1 | tail -5
```

Expected: `added X packages` line; no errors. (Sharp installs a native binary — may take ~30s.)

- [ ] **Step 3: Confirm baseline tests pass**

```bash
npm test -- tests/unit/student/student.test.ts
```

Expected: all existing student tests pass. If anything fails on baseline, stop and surface to the user.

- [ ] **Step 4: Commit dependency additions**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add sharp, react-easy-crop, react-webcam for student photo upload"
```

---

## Task 1: Add `getObject` helper to r2.ts

The action needs to download the user-uploaded blob from R2 to feed into `sharp`. r2.ts has `headObject` and `deleteFile` but no buffer-read helper.

**Files:**
- Modify: `src/lib/storage/r2.ts` (add `getObject` after `headObject`)

- [ ] **Step 1: Read the current r2.ts to confirm the imports + factory pattern**

```bash
sed -n '1,15p' src/lib/storage/r2.ts
```

You should see `GetObjectCommand` already imported, and the file uses `getClient()` and `getBucket()` factories (NOT module-level constants).

- [ ] **Step 2: Add the `getObject` helper after `headObject`**

Open `src/lib/storage/r2.ts`. Find the `headObject` function (line ~108-123). After its closing brace, but BEFORE the `// ─── Delete ────` comment, insert:

```typescript

/**
 * Downloads an R2 object as a Buffer.
 * Throws if the object does not exist or the request fails.
 *
 * Used server-side for image processing pipelines that need the raw bytes
 * (e.g., resize via sharp before re-uploading).
 */
export async function getObject(key: string): Promise<Buffer> {
  const out = await getClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  if (!out.Body) {
    throw new Error(`R2 getObject returned no body for key: ${key}`);
  }
  // SDK returns a Readable stream in Node; collect into a Buffer.
  const chunks: Buffer[] = [];
  for await (const chunk of out.Body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "r2\.ts" | head -5
```

Expected: no errors related to `r2.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/r2.ts
git commit -m "feat(storage): add getObject helper to read R2 buffers"
```

---

## Task 2: Update resolver to detect key vs URL

The existing `resolveStudentPhotoUrl` returns `student.photoUrl` directly when set. Going forward we store an R2 key in that field; the resolver must sign keys at read time while still passing through legacy full URLs unchanged.

**Files:**
- Modify: `src/modules/student/actions/photo.ts` (line 28)

- [ ] **Step 1: Read the current resolver**

```bash
sed -n '19,45p' src/modules/student/actions/photo.ts
```

You should see line 28 as `if (student.photoUrl) return student.photoUrl;`.

- [ ] **Step 2: Replace line 28 with the key-vs-URL heuristic**

Open `src/modules/student/actions/photo.ts`. Find:

```typescript
  if (student.photoUrl) return student.photoUrl;
```

Replace with:

```typescript
  if (student.photoUrl) {
    // photoUrl may hold either a legacy full URL or an R2 key (new uploads).
    // Keys are signed at read time; URLs (with scheme) are returned as-is.
    if (student.photoUrl.startsWith("http")) return student.photoUrl;
    return await getSignedDownloadUrl(student.photoUrl);
  }
```

(`getSignedDownloadUrl` is already imported at line 6.)

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "photo\.ts" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/student/actions/photo.ts
git commit -m "feat(students): resolver detects key vs URL in Student.photoUrl"
```

---

## Task 3: `setStudentPhotoAction` + `removeStudentPhotoAction` (TDD)

Two server actions. Both gated by `STUDENTS_UPDATE` (note plural). `setStudentPhotoAction` reads the temp upload from R2, resizes via `sharp`, writes to a stable key, updates `Student.photoUrl`, audits, and cleans up the temp upload. `removeStudentPhotoAction` deletes the stable-key R2 object and clears the field.

**Files:**
- Create: `src/modules/student/actions/photo-upload.ts`
- Create: `tests/unit/student/photo-upload.test.ts`

### Step 1: Write the failing test scaffolding (1 test to start)

Create `tests/unit/student/photo-upload.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  setStudentPhotoAction,
  removeStudentPhotoAction,
} from "@/modules/student/actions/photo-upload";

// Mock r2 storage helpers
vi.mock("@/lib/storage/r2", () => ({
  getObject: vi.fn().mockResolvedValue(Buffer.from("fake-image-bytes")),
  uploadFile: vi.fn().mockResolvedValue({ key: "students/s1/photo.jpg", url: "https://r2.example/students/s1/photo.jpg" }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/students/s1/photo.jpg"),
}));

// Mock sharp — return an object with chainable methods that all return the same proxy
vi.mock("sharp", () => {
  const sharpProxy = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("resized-bytes")),
  };
  return { default: vi.fn(() => sharpProxy) };
});

describe("setStudentPhotoAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/abc.jpg" });
    expect(result).toEqual({ error: "Unauthorized" });
  });
});
```

### Step 2: Run, confirm fail

```bash
npm test -- tests/unit/student/photo-upload.test.ts
```

Expected: fail with "Cannot find module '@/modules/student/actions/photo-upload'".

### Step 3: Implement the action file

Create `src/modules/student/actions/photo-upload.ts`:

```typescript
"use server";

import sharp from "sharp";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  getObject,
  uploadFile,
  deleteFile,
  getSignedDownloadUrl,
} from "@/lib/storage/r2";

interface SetPhotoInput {
  studentId: string;
  fileKey: string; // temporary R2 key from /api/upload
}

interface RemovePhotoInput {
  studentId: string;
}

/**
 * Pulls the temp upload from R2, resizes to 800x800 JPEG (q85) via sharp,
 * writes to a stable per-student key, updates Student.photoUrl to that key,
 * deletes the temp upload, and audits.
 */
export async function setStudentPhotoAction(input: SetPhotoInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!student) return { error: "Student not found" };

  let resized: Buffer;
  try {
    const sourceBuffer = await getObject(input.fileKey);
    resized = await sharp(sourceBuffer)
      .rotate() // honor EXIF orientation
      .resize({ width: 800, height: 800, fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    // Best-effort cleanup of the temp upload before returning
    await deleteFile(input.fileKey).catch(() => {});
    console.error("[setStudentPhotoAction] sharp failed:", err);
    return { error: "Could not process image" };
  }

  const stableKey = `students/${input.studentId}/photo.jpg`;
  await uploadFile({
    key: stableKey,
    body: resized,
    contentType: "image/jpeg",
  });

  await db.student.update({
    where: { id: input.studentId },
    data: { photoUrl: stableKey },
  });

  // Best-effort cleanup of the temp upload (don't block on failure)
  await deleteFile(input.fileKey).catch((err) => {
    console.error("[setStudentPhotoAction] failed to delete temp upload:", err);
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Student",
    entityId: input.studentId,
    module: "student",
    description: "Updated student photo",
  });

  // Return a freshly signed URL so the client can refresh the avatar immediately
  const photoSrc = await getSignedDownloadUrl(stableKey);
  return { data: { photoKey: stableKey, photoSrc } };
}

/**
 * Clears Student.photoUrl. If the stored value is an R2 key (no scheme), also
 * deletes the R2 object. Legacy URL values are nulled but not deleted (we don't
 * own external URLs).
 */
export async function removeStudentPhotoAction(input: RemovePhotoInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: { id: true, photoUrl: true },
  });
  if (!student) return { error: "Student not found" };

  if (student.photoUrl == null) {
    return { data: { ok: true } };
  }

  const isKey = !student.photoUrl.startsWith("http");

  if (isKey) {
    await deleteFile(student.photoUrl).catch((err) => {
      console.error("[removeStudentPhotoAction] failed to delete R2 object:", err);
    });
  }

  await db.student.update({
    where: { id: input.studentId },
    data: { photoUrl: null },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Student",
    entityId: input.studentId,
    module: "student",
    description: "Removed student photo",
  });

  return { data: { ok: true } };
}
```

### Step 4: Run, confirm the auth test passes

```bash
npm test -- tests/unit/student/photo-upload.test.ts
```

Expected: 1 test passes.

### Step 5: Add the remaining 8 tests

Append to `tests/unit/student/photo-upload.test.ts` (inside the `describe("setStudentPhotoAction", ...)` block, then a new sibling block for remove):

```typescript
  it("rejects callers without STUDENTS_UPDATE", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/abc.jpg" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' on cross-school access", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await setStudentPhotoAction({ studentId: "from-other-school", fileKey: "tmp/abc.jpg" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("resizes via sharp, uploads to stable key, updates Student.photoUrl, and cleans up temp", async () => {
    const r2 = await import("@/lib/storage/r2");
    const sharpModule = await import("sharp");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/student-photo/s1/abc.jpg" });

    expect(result).toHaveProperty("data");
    // sharp called with the source buffer
    expect(sharpModule.default).toHaveBeenCalled();
    // Uploaded to stable key
    expect(r2.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ key: "students/s1/photo.jpg", contentType: "image/jpeg" }),
    );
    // photoUrl updated to the stable key
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { photoUrl: "students/s1/photo.jpg" },
      }),
    );
    // Temp upload deleted
    expect(r2.deleteFile).toHaveBeenCalledWith("tmp/student-photo/s1/abc.jpg");
  });

  it("returns error and cleans up temp when source download fails", async () => {
    // Exercises the try/catch around the sharp pipeline by failing the upstream
    // step (getObject) — keeps the test simple and stable across vitest mock
    // implementations of sharp.
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    vi.mocked(r2.getObject).mockRejectedValueOnce(new Error("not found"));

    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/missing.jpg" });

    expect(result).toEqual({ error: "Could not process image" });
    expect(r2.deleteFile).toHaveBeenCalledWith("tmp/missing.jpg");
    // Did NOT update the student
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });
});

describe("removeStudentPhotoAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await removeStudentPhotoAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects callers without STUDENTS_UPDATE", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await removeStudentPhotoAction({ studentId: "s1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' on cross-school access", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await removeStudentPhotoAction({ studentId: "from-other-school" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("is a no-op when photoUrl is null", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: null } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).not.toHaveBeenCalled();
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it("deletes R2 object and nulls photoUrl when stored value is a key", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: "students/s1/photo.jpg" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).toHaveBeenCalledWith("students/s1/photo.jpg");
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { photoUrl: null },
      }),
    );
  });

  it("nulls photoUrl but does NOT call R2 delete when stored value is a legacy URL", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: "https://legacy.example/photo.jpg" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).not.toHaveBeenCalled();
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { photoUrl: null },
      }),
    );
  });
});
```

### Step 6: Run all tests

```bash
npm test -- tests/unit/student/photo-upload.test.ts
```

Expected: 9 tests pass (1 from step 1 + 4 in setStudentPhoto + 4 in removeStudentPhoto = 9).

### Step 7: Run full student folder

```bash
npm test -- tests/unit/student/
```

Expected: all student tests pass. No regressions.

### Step 8: Commit

```bash
git add src/modules/student/actions/photo-upload.ts tests/unit/student/photo-upload.test.ts
git commit -m "feat(students): add setStudentPhotoAction and removeStudentPhotoAction"
```

---

## Task 4: `<PhotoAvatar>` clickable avatar component

A small component that renders the photo (or initials fallback) and opens the uploader modal when clicked, gated by `canEdit`.

**Files:**
- Create: `src/components/students/photo-avatar.tsx`

### Step 1: Create the component

`src/components/students/photo-avatar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PhotoUploader } from "./photo-uploader";

export interface PhotoAvatarProps {
  studentId: string;
  photoSrc: string | null;
  fallbackInitials: string;
  canEdit: boolean;
  size?: "sm" | "md" | "lg";
  /**
   * Called after a successful upload (with new signed URL) or removal (null).
   */
  onPhotoChanged?: (newPhotoSrc: string | null) => void;
}

const SIZE_CLASSES: Record<NonNullable<PhotoAvatarProps["size"]>, string> = {
  sm: "h-12 w-12 text-sm",
  md: "h-24 w-24 text-2xl",
  lg: "h-32 w-32 text-3xl",
};

export function PhotoAvatar({
  studentId,
  photoSrc,
  fallbackInitials,
  canEdit,
  size = "md",
  onPhotoChanged,
}: PhotoAvatarProps) {
  const [open, setOpen] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  const clickable = canEdit;
  const handleClick = clickable ? () => setOpen(true) : undefined;

  const baseClasses = `relative flex flex-shrink-0 items-center justify-center rounded-full overflow-hidden ${sizeClass}`;
  const interactiveClasses = clickable
    ? "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
    : "";

  const Wrapper = clickable ? "button" : "div";

  return (
    <>
      <Wrapper
        type={clickable ? "button" : undefined}
        onClick={handleClick}
        className={`${baseClasses} ${interactiveClasses} ${photoSrc ? "" : "bg-muted text-muted-foreground font-bold"}`}
        aria-label={clickable ? "Edit student photo" : undefined}
      >
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt="Student photo"
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{fallbackInitials}</span>
        )}
        {clickable && photoSrc && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-[10px] text-white py-0.5">
            Edit
          </span>
        )}
      </Wrapper>

      {open && (
        <PhotoUploader
          studentId={studentId}
          currentPhotoSrc={photoSrc}
          open={open}
          onClose={() => setOpen(false)}
          onSuccess={(newPhotoSrc) => {
            setOpen(false);
            onPhotoChanged?.(newPhotoSrc);
          }}
        />
      )}
    </>
  );
}
```

### Step 2: Smoke check (PhotoUploader doesn't exist yet — TS will error briefly)

```bash
npx tsc --noEmit 2>&1 | grep -E "photo-avatar" | head -5
```

Expected: ONE error about `Cannot find module './photo-uploader'`. We'll fix this in Task 5 by creating it.

### Step 3: Commit

We commit even though the import is broken, because Task 5 lands the missing file. The commit boundary is intentional — this isolates the avatar's surface from the modal's logic.

```bash
git add src/components/students/photo-avatar.tsx
git commit -m "feat(students): add PhotoAvatar component (clickable avatar with initials fallback)"
```

---

## Task 5: `<PhotoUploader>` modal with file/webcam/cropper

The biggest UI piece: modal with two tabs (file picker, webcam), shared cropper view, and a submit flow that hits `/api/upload` then `setStudentPhotoAction`.

**Files:**
- Create: `src/components/students/photo-uploader.tsx`

### Step 1: Create the component

`src/components/students/photo-uploader.tsx`:

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import Webcam from "react-webcam";
import {
  setStudentPhotoAction,
  removeStudentPhotoAction,
} from "@/modules/student/actions/photo-upload";

interface PhotoUploaderProps {
  studentId: string;
  currentPhotoSrc: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (newPhotoSrc: string | null) => void;
}

type Tab = "file" | "webcam";
type View = "select" | "crop" | "confirm-remove";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION = 300;

/**
 * Validates a File before showing the cropper. Returns null if OK, else an error message.
 */
async function validateImage(file: File): Promise<string | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, and WebP images are accepted.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Photo must be 5 MB or smaller.";
  }
  // Check dimensions by loading into a temporary image
  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = url;
    });
    if (dims.w < MIN_DIMENSION || dims.h < MIN_DIMENSION) {
      return `Photo must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels.`;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return null;
}

/**
 * Returns a JPEG Blob containing the cropped square region of `imageUrl` according
 * to `area` (px coords from react-easy-crop's onCropComplete callback).
 * The output canvas is exactly the crop region; server resize then standardizes to 800×800.
 */
async function getCroppedBlob(imageUrl: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Image load failed"));
    i.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

export function PhotoUploader({
  studentId,
  currentPhotoSrc,
  open,
  onClose,
  onSuccess,
}: PhotoUploaderProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [view, setView] = useState<View>("select");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const webcamRef = useRef<Webcam | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  if (!open) return null;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const errMsg = await validateImage(file);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setView("crop");
  }

  function handleCapture() {
    setError(null);
    const dataUrl = webcamRef.current?.getScreenshot();
    if (!dataUrl) {
      setError("Could not capture from webcam.");
      return;
    }
    // Webcam screenshots are typically 640×480 — meets the 300×300 minimum.
    setImageSrc(dataUrl);
    setView("crop");
  }

  async function handleSubmitCrop() {
    if (!imageSrc || !croppedArea) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const formData = new FormData();
      formData.append("file", blob, "photo.jpg");
      formData.append("module", "student-photo");
      formData.append("entityId", studentId);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const { key } = (await res.json()) as { key: string };
      const result = await setStudentPhotoAction({ studentId, fileKey: key });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(result.data.photoSrc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmRemove() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await removeStudentPhotoAction({ studentId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Update student photo</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {view === "select" && (
          <>
            {/* Tabs */}
            <div className="mb-4 flex border-b">
              <button
                type="button"
                onClick={() => setTab("file")}
                className={`px-4 py-2 text-sm border-b-2 ${
                  tab === "file" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setTab("webcam")}
                className={`px-4 py-2 text-sm border-b-2 ${
                  tab === "webcam" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
              >
                Use webcam
              </button>
            </div>

            {tab === "file" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  JPEG, PNG, or WebP. Maximum 5 MB. At least 300×300 pixels.
                </p>
                <input
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileSelected}
                  className="block w-full text-sm"
                />
              </div>
            )}

            {tab === "webcam" && (
              <div className="space-y-3">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                  className="w-full rounded-md border"
                  onUserMediaError={() =>
                    setError("Camera unavailable — please use the upload tab.")
                  }
                />
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Capture
                </button>
              </div>
            )}
          </>
        )}

        {view === "crop" && imageSrc && (
          <>
            <div className="relative h-64 w-full bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </>
        )}

        {view === "confirm-remove" && (
          <p className="py-4 text-sm">
            Remove this student&apos;s photo? Initials will be shown until a new photo is uploaded.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-end gap-2">
          {view === "crop" && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (imageSrc) URL.revokeObjectURL(imageSrc);
                  setImageSrc(null);
                  setCroppedArea(null);
                  setView("select");
                }}
                disabled={isSubmitting}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmitCrop}
                disabled={isSubmitting || !croppedArea}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Use this photo"}
              </button>
            </>
          )}

          {view === "select" && (
            <>
              {currentPhotoSrc && (
                <button
                  type="button"
                  onClick={() => setView("confirm-remove")}
                  disabled={isSubmitting}
                  className="mr-auto rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}

          {view === "confirm-remove" && (
            <>
              <button
                type="button"
                onClick={() => setView("select")}
                disabled={isSubmitting}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isSubmitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? "Removing…" : "Remove"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "(photo-avatar|photo-uploader)" | head -10
```

Expected: no errors. (Task 4's stale `Cannot find module` should now resolve.)

### Step 3: Commit

```bash
git add src/components/students/photo-uploader.tsx
git commit -m "feat(students): add PhotoUploader modal with file/webcam tabs and cropper"
```

---

## Task 6: Wire `<PhotoAvatar>` into student profile

**Files:**
- Modify: `src/app/(dashboard)/students/[id]/page.tsx`
- Modify: `src/app/(dashboard)/students/[id]/student-profile.tsx`

### Step 1: Update the server page to compute permission and resolve photo

Open `src/app/(dashboard)/students/[id]/page.tsx`. Add to the imports at the top:

```typescript
import { PERMISSIONS } from "@/lib/permissions";
import { resolveStudentPhotoUrl } from "@/modules/student/actions/photo";
```

Inside `StudentProfilePage`, after `const session = await auth();` and the `if (!session?.user) return null;` block, add:

```typescript
  const perms = session.user.permissions ?? [];
  const canEditStudent = perms.includes("*") || perms.includes(PERMISSIONS.STUDENTS_UPDATE);
```

Then in the existing parallel data fetch (the `Promise.all([...])` block around lines 24-30), keep the existing parallel calls AND add the photo resolution. Find:

```typescript
  const [studentResult, guardiansResult, classesResult, academicYearsResult, termsResult] =
    await Promise.all([
      getStudentAction(id),
      getGuardiansAction(),
      getClassesAction(),
      getAcademicYearsAction(),
      getTermsAction(),
    ]);
```

Replace with:

```typescript
  const [studentResult, guardiansResult, classesResult, academicYearsResult, termsResult] =
    await Promise.all([
      getStudentAction(id),
      getGuardiansAction(),
      getClassesAction(),
      getAcademicYearsAction(),
      getTermsAction(),
    ]);

  // Resolve the student photo URL after the student is confirmed (resolver
  // will return PLACEHOLDER_PHOTO_SENTINEL for missing students; we treat that
  // as "no photo" — the avatar will fall back to initials).
```

Then after the `notFound()` block (right before `const student = studentResult.data;`), the photo can be resolved now that we know the student exists. Find the line `const student = studentResult.data;` and AFTER it, insert:

```typescript
  const { PLACEHOLDER_PHOTO_SENTINEL } = await import("@/lib/pdf/constants");
  const resolvedPhoto = await resolveStudentPhotoUrl(student.id);
  const photoSrc = resolvedPhoto === PLACEHOLDER_PHOTO_SENTINEL ? null : resolvedPhoto;
```

(Dynamic import keeps the constant local; alternatively add a top-level import for `PLACEHOLDER_PHOTO_SENTINEL` if your codebase prefers that.)

Then update the `<StudentProfile>` JSX (around line 76) to pass the new props:

```tsx
      <StudentProfile
        student={student}
        allGuardians={allGuardians}
        classArmOptions={classArmOptions}
        academicYears={academicYears}
        terms={terms}
        photoSrc={photoSrc}
        canEditStudent={canEditStudent}
      />
```

### Step 2: Update `student-profile.tsx`

Open `src/app/(dashboard)/students/[id]/student-profile.tsx`.

**a)** Add to the imports at the top of the file:

```typescript
import { useRouter } from "next/navigation";
import { PhotoAvatar } from "@/components/students/photo-avatar";
```

**b)** Find the props destructure / type. It currently looks like:

```typescript
export function StudentProfile({
  student,
  allGuardians,
  classArmOptions,
  academicYears,
  terms,
}: {
  student: StudentWithRelations;
  allGuardians: GuardianOption[];
  classArmOptions: ClassArmOption[];
  academicYears: AcademicYearOption[];
  terms: TermOption[];
}) {
```

Replace with:

```typescript
export function StudentProfile({
  student,
  allGuardians,
  classArmOptions,
  academicYears,
  terms,
  photoSrc,
  canEditStudent,
}: {
  student: StudentWithRelations;
  allGuardians: GuardianOption[];
  classArmOptions: ClassArmOption[];
  academicYears: AcademicYearOption[];
  terms: TermOption[];
  photoSrc: string | null;
  canEditStudent: boolean;
}) {
```

(If the existing prop types use a separate named interface, add the two new fields to that interface instead.)

**c)** Add the router hook near the top of the component body (alongside other `useState` calls):

```typescript
  const router = useRouter();
```

**d)** Find the existing initials block (around lines 393-397):

```tsx
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
                {student.firstName[0]}
                {student.lastName[0]}
              </div>
```

Replace with:

```tsx
              <PhotoAvatar
                studentId={student.id}
                photoSrc={photoSrc}
                fallbackInitials={`${student.firstName[0]}${student.lastName[0]}`}
                canEdit={canEditStudent}
                size="md"
                onPhotoChanged={() => router.refresh()}
              />
```

### Step 3: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "(student-profile|students/\[id\]/page)" | head -10
```

Expected: no NEW errors. (Pre-existing errors elsewhere are fine.)

### Step 4: Run all student tests

```bash
npm test -- tests/unit/student/
```

Expected: all green (no test changes; this task adds no tests but should not break any).

### Step 5: Commit

```bash
git add 'src/app/(dashboard)/students/[id]/page.tsx' 'src/app/(dashboard)/students/[id]/student-profile.tsx'
git commit -m "feat(students): wire PhotoAvatar into profile (gated by STUDENTS_UPDATE)"
```

---

## Task 7: Final verification + PR

### Step 1: Full test sweep

```bash
npm test -- tests/unit/
```

Expected: all green.

### Step 2: Type check the project

```bash
npx tsc --noEmit 2>&1 | grep -E "photo-(upload|avatar|uploader)|students/\[id\]/page|r2\.ts" | head -20
```

Expected: no NEW errors related to the files in this PR.

### Step 3: Git log

```bash
git log --oneline main..HEAD
```

Expected: 7 commits (deps + getObject + resolver + actions + avatar + uploader + wiring) plus any spec/plan commits already on the branch.

### Step 4: Browser verification (manual checklist)

`npm run dev`, log in as super_admin, navigate to a student profile.

1. Confirm the existing initials placeholder is replaced by `<PhotoAvatar>` (still showing initials before any upload).
2. Click the avatar → modal opens with two tabs ("Upload file" / "Use webcam") and a "Cancel" button.
3. **Upload-file flow**: drag or pick a JPEG ≥ 300×300 → cropper appears with a square crop box → pan and zoom → click "Use this photo" → modal closes → profile re-renders with the new photo.
4. Reload page → photo persists (resolver signs the stored key).
5. Click avatar again → modal reopens. Click "Remove photo" → confirm dialog → photo cleared, fallback initials reappear.
6. Click avatar again → switch to "Use webcam" tab → grant camera permission → click "Capture" → cropper → "Use this photo" → confirm new photo persists.
7. **Validation**: try uploading a file > 5MB → see error in modal. Try a 100×100 image → see error. Try a PDF → see error.
8. **Webcam permission denial**: deny camera access in the browser → confirm fallback message appears.
9. Open the rendered ID card PDF for that student → confirm the new photo is embedded (the existing ID card renderer uses `resolveStudentPhotoUrl`).
10. Log in as a teacher account (no `STUDENTS_UPDATE`) → confirm the avatar renders the photo but is NOT clickable.
11. Run `npm test -- tests/unit/student/photo-upload.test.ts` — all 9 green.

### Step 5: Push and open PR

```bash
git push -u origin feat/student-photo-upload
gh pr create --base main --title "feat(students): student photo upload (Tier 3 #11)" --body "$(cat <<'EOF'
## Summary

Wires the dormant `Student.photoUrl` field into a click-the-avatar uploader on the profile page.

- File picker + webcam capture, both feed a 1:1 cropper (react-easy-crop)
- Server-side resize via sharp to 800×800 JPEG q85
- Stable per-student R2 key (`students/<id>/photo.jpg`) overwrites on PUT
- Resolver updated to detect key vs URL and sign keys at read time
- Reuses STUDENTS_UPDATE permission; no new permission keys

## Test plan
- [ ] CI green (unit + lint + typecheck)
- [ ] Manual: super_admin → student profile → click avatar → upload via file → see new photo
- [ ] Manual: same flow via webcam capture
- [ ] Manual: remove photo → initials reappear
- [ ] Manual: teacher account (no STUDENTS_UPDATE) → avatar not clickable
- [ ] Manual: rendered ID card includes new photo

## Spec / plan
- Spec: `docs/superpowers/specs/2026-05-01-student-photo-upload-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-student-photo-upload.md`

Closes Tier 3 #11 from the Students-module feature-depth review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(If `gh auth` is expired, the implementer should report back so the user can open the PR via browser at the URL the push command prints.)

---
