import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | undefined;

/**
 * Returns a Nodemailer transporter singleton.
 * Uses SMTP configuration from environment variables.
 */
export function getEmailTransport(): Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error("SMTP configuration incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASS.");
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return transporter;
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM || "noreply@school.edu.gh";
}
