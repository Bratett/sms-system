import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters")
    .regex(/^[a-z_]+$/, "Role name must be lowercase letters and underscores only"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(100),
  description: z.string().optional().or(z.literal("")),
  permissionIds: z.array(z.string()),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
