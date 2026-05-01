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
