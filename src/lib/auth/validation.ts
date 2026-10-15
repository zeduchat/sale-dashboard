// Pure helpers, safe to import from client components too.

export const INVITE_TOKEN_LENGTH = 9;
export const PASSWORD_MIN = 10;

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Uppercases and strips spaces/dashes so "abcd-efgh-j" and "ABCDEFGHJ" are the same token. */
export function normalizeInviteToken(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\s-]/g, "").toUpperCase();
  return new RegExp(`^[A-Z0-9]{${INVITE_TOKEN_LENGTH}}$`).test(t) ? t : null;
}

export function validateName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().replace(/\s+/g, " ");
  return n.length >= 2 && n.length <= 80 ? n : null;
}

/** Returns an error message to show the user, or null when the password is acceptable. */
export function passwordProblem(v: unknown): string | null {
  if (typeof v !== "string") return "Enter a password.";
  if (v.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (v.length > 128) return "Use 128 characters or fewer.";
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return "Include at least one letter and one number.";
  return null;
}
