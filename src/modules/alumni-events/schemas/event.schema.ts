import { z } from "zod";

export const createAlumniEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  maxGuestsPerRsvp: z.number().int().min(0).default(0),
  rsvpDeadline: z.coerce.date().optional().nullable(),
}).refine(
  (data) => !data.endAt || data.endAt >= data.startAt,
  { message: "endAt must be on or after startAt", path: ["endAt"] },
).refine(
  (data) => !data.rsvpDeadline || data.rsvpDeadline <= data.startAt,
  { message: "rsvpDeadline must be on or before startAt", path: ["rsvpDeadline"] },
);

export const updateAlumniEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  maxGuestsPerRsvp: z.number().int().min(0).optional(),
  rsvpDeadline: z.coerce.date().optional().nullable(),
});

export const upsertRsvpSchema = z.object({
  eventId: z.string().min(1),
  response: z.enum(["YES", "NO", "MAYBE"]),
  guestCount: z.number().int().min(0).default(0),
});

export type CreateAlumniEventInput = z.infer<typeof createAlumniEventSchema>;
export type UpdateAlumniEventInput = z.infer<typeof updateAlumniEventSchema>;
export type UpsertRsvpInput = z.infer<typeof upsertRsvpSchema>;
