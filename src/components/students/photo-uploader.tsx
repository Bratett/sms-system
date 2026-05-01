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
