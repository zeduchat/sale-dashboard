"use client";

import { Lock, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/zedu";
import { normalizeEmail, passwordProblem, validateName } from "@/lib/auth/validation";
import { AvatarPlaceholder } from "./AvatarPlaceholder";
import { FormError } from "./FormError";
import { useAuthRequest } from "./useAuthRequest";

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

/** Final onboarding step: picture placeholder, name, email, password + confirmation. Signs the user in on success. */
export function ProfileSetupForm({ lockedEmail }: { lockedEmail: string | null }) {
  const { pending, error, submit } = useAuthRequest("/api/auth/invite/accept");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!validateName(name)) next.name = "Enter your full name.";
    if (!normalizeEmail(email)) next.email = "Enter a valid email address.";
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    if (!next.password && confirm !== password) next.confirm = "The passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    if (await submit({ name, email, password, confirmPassword: confirm })) window.location.assign("/");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <AvatarPlaceholder name={name} />
      <FormError message={error} />
      <Input
        label="Full name"
        icon={<UserRound aria-hidden />}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />
      <Input
        label="Email"
        type="email"
        icon={<Mail aria-hidden />}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={!!lockedEmail}
        helper={lockedEmail ? "Your invite was sent to this address." : undefined}
        error={errors.email}
        required
      />
      <Input
        label="Password"
        type="password"
        icon={<Lock aria-hidden />}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        helper="At least 10 characters, with a letter and a number."
        error={errors.password}
        required
      />
      <Input
        label="Confirm password"
        type="password"
        icon={<Lock aria-hidden />}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
        required
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account and sign in"}
      </Button>
    </form>
  );
}
