"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/zedu";
import { INVITE_TOKEN_LENGTH, normalizeInviteToken } from "@/lib/auth/validation";
import { FormError } from "./FormError";
import { useAuthRequest } from "./useAuthRequest";

/** /setup: enter the 9-character code from your invite. */
export function TokenForm({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const { pending, error, submit } = useAuthRequest("/api/auth/invite/verify");
  const [token, setToken] = useState(initialToken.toUpperCase());
  const ready = normalizeInviteToken(token) !== null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (await submit({ token })) router.push("/setup/profile");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Input
        label="Setup code"
        helper={`${INVITE_TOKEN_LENGTH} characters, from your invite email.`}
        icon={<KeyRound aria-hidden />}
        value={token}
        onChange={(e) => setToken(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={INVITE_TOKEN_LENGTH + 4}
        placeholder="ABCD-EFGH-J"
        className="[&_input]:font-mono [&_input]:tracking-widest"
        autoFocus
        required
      />
      <Button type="submit" className="w-full" disabled={pending || !ready}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
