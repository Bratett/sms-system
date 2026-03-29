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

  // Redis (optional - required for background jobs)
  REDIS_URL: z.string().optional(),

  // Cloudflare R2 Storage (optional - required for file uploads)
  R2_ENDPOINT: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // SMS Gateway (optional - required for SMS delivery)
  SMS_PROVIDER: z.enum(["hubtel", "mock"]).optional().default("mock"),
  SMS_API_KEY: z.string().optional(),
  SMS_API_SECRET: z.string().optional(),
  SMS_SENDER_ID: z.string().optional().default("SMS"),

  // Paystack (optional - required for online payments)
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),

  // Email SMTP (optional - required for email notifications)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().default("587"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional().default("noreply@school.edu.gh"),
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
