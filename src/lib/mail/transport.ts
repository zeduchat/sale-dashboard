import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return cached;
}

export type MailInput = { to: string | string[]; subject: string; text: string; html: string };

/**
 * Sends an email. Never throws: returns false when SMTP isn't configured or delivery fails, so a mail
 * outage can't break invite creation. Without SMTP_HOST the message is printed to the server log (dev).
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn(`[mail] SMTP_HOST not set; not sent. To: ${[input.to].flat().join(", ")} | ${input.subject}\n${input.text}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? "Zedu <no-reply@localhost>", ...input });
    return true;
  } catch (err) {
    console.error("[mail] delivery failed", err);
    return false;
  }
}
