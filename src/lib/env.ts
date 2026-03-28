import { z } from "zod";

/**
 * Environment variable validation using Zod.
 * Validates required env vars at startup and provides typed access.
 * Import this module early to fail fast on misconfiguration.
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .startsWith("postgresql://", "DATABASE_URL must start with postgresql://"),

  // Authentication
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters for security"),

  // NextAuth URL (optional in development, recommended in production)
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      "\n" +
        "========================================\n" +
        " Invalid environment variables:\n" +
        "========================================\n" +
        formatted +
        "\n" +
        "========================================\n" +
        " Please check your .env file.\n" +
        "========================================\n",
    );

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}

export const env = validateEnv();
