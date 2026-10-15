import { CircleAlert } from "lucide-react";

/** Form-level error banner (field-level errors go on the Input itself). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-z-md border border-z-line-danger bg-z-danger/5 px-3 py-2 text-z-small text-z-fg-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
