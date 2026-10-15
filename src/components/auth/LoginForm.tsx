"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/zedu";
import { FormError } from "./FormError";
import { GoogleButton } from "./GoogleButton";
import { useAuthRequest } from "./useAuthRequest";

const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "That Google account can't sign in. It may be deactivated or have an unverified email. Contact an admin.",
};

type Props = { next: string; oauthError?: string };

export function LoginForm({ next, oauthError }: Props) {
  const { pending, error, submit } = useAuthRequest<{ next: string }>("/api/auth/login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await submit({ email, password, next });
    // Full navigation so middleware and server components see the new cookies.
    if (res) window.location.assign(res.next);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error ?? (oauthError ? (OAUTH_ERRORS[oauthError] ?? "Google sign-in failed. Try again.") : null)} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          icon={<Mail aria-hidden />}
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          icon={<Lock aria-hidden />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={pending || !email || !password}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-z-caption text-z-fg-muted">
        <span className="h-px flex-1 bg-z-line" />
        or
        <span className="h-px flex-1 bg-z-line" />
      </div>

      <GoogleButton next={next} />

      <p className="text-center text-z-small text-z-fg-muted">
        Have a setup code?{" "}
        <Link href="/setup" className="font-medium text-z-fg-accent hover:underline">
          Activate your account
        </Link>
      </p>
    </div>
  );
}
