"use client";

import { CircleCheck, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, FieldLabel, Input, buttonClass } from "@/components/zedu";
import { normalizeEmail, validateName } from "@/lib/auth/validation";
import { FormError } from "./FormError";
import { useAuthRequest } from "./useAuthRequest";

export function RequestAccessForm() {
  const { pending, error, submit } = useAuthRequest("/api/auth/request-access");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const valid = !!validateName(name) && !!normalizeEmail(email);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await submit({ name, email, message })) setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CircleCheck aria-hidden className="size-8 text-z-status-success" />
        <p className="text-z-body text-z-fg">Request sent</p>
        <p className="text-z-small text-z-fg-muted">An admin will review it. If approved, you&apos;ll get an email with your setup code.</p>
        <Link href="/login" className={buttonClass({ variant: "secondary" })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Input label="Full name" icon={<UserRound aria-hidden />} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Work email" type="email" icon={<Mail aria-hidden />} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="request-message">Message (optional)</FieldLabel>
        <textarea
          id="request-message"
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Who are you and why do you need access?"
          className="resize-none rounded-z-md border border-z-line-strong bg-z-surface px-3 py-2 text-z-body text-z-fg shadow-z-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-z-fg-placeholder hover:border-z-line-hover focus:border-z-line-focus focus:shadow-z-focus-input"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !valid}>
        {pending ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
