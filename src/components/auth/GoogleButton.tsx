"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/zedu";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.7 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}

/** Starts Google OAuth. Existing users only; /api/auth/google/complete turns the result into the app session. */
export function GoogleButton({ next = "/" }: { next?: string }) {
  return (
    <Button
      variant="secondary"
      className="w-full"
      icon={<GoogleMark />}
      onClick={() => signIn("google", { callbackUrl: `/api/auth/google/complete?next=${encodeURIComponent(next)}` })}
    >
      Continue with Google
    </Button>
  );
}
