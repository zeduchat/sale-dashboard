import { appUrl } from "@/lib/auth/config";
import type { MailInput } from "./transport";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, bodyHtml: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 16px">${esc(heading)}</h2>${bodyHtml}
<p style="color:#888;font-size:12px;margin-top:32px">Zedu Sales Dashboard</p></div>`;
}

export function inviteEmail(opts: { to: string; token: string; inviterName: string; expiresAt: Date }): MailInput {
  const link = `${appUrl()}/setup?token=${encodeURIComponent(opts.token)}`;
  const expires = opts.expiresAt.toUTCString();
  return {
    to: opts.to,
    subject: `${opts.inviterName} invited you to Zedu`,
    text: `${opts.inviterName} invited you to the Zedu sales dashboard.\n\nYour setup code: ${opts.token}\nOpen: ${link}\n\nThe code works once and expires ${expires}.`,
    html: layout(
      "You're invited",
      `<p>${esc(opts.inviterName)} invited you to the Zedu sales dashboard.</p>
<p style="font-size:28px;letter-spacing:4px;font-family:monospace;background:#f4f4f5;padding:12px 16px;border-radius:8px;display:inline-block">${esc(opts.token)}</p>
<p><a href="${esc(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Set up your account</a></p>
<p style="color:#666;font-size:13px">The code works once and expires ${esc(expires)}.</p>`,
    ),
  };
}

export function accessRequestEmail(opts: { to: string[]; name: string; email: string; message: string | null }): MailInput {
  const link = `${appUrl()}/invites`;
  return {
    to: opts.to,
    subject: `${opts.name} requested access to Zedu`,
    text: `${opts.name} <${opts.email}> requested access.${opts.message ? `\n\n"${opts.message}"` : ""}\n\nReview and invite: ${link}`,
    html: layout(
      "Access request",
      `<p><b>${esc(opts.name)}</b> (${esc(opts.email)}) requested access.</p>${
        opts.message ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#555">${esc(opts.message)}</blockquote>` : ""
      }<p><a href="${esc(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Review requests</a></p>`,
    ),
  };
}
