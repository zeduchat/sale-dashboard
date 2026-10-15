import { Camera, UserRound } from "lucide-react";
import { Button } from "@/components/zedu";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "";
}

/** Profile picture slot. Upload isn't built yet, so this shows initials and a disabled action. */
export function AvatarPlaceholder({ name }: { name: string }) {
  const initials = initialsOf(name);
  return (
    <div className="flex items-center gap-4">
      <div
        aria-hidden
        className="grid size-16 shrink-0 place-items-center rounded-full border border-dashed border-z-line-strong bg-z-sunken text-z-section text-z-fg-secondary"
      >
        {initials || <UserRound className="size-6 text-z-icon" />}
      </div>
      <div className="flex flex-col items-start gap-1">
        <Button variant="secondary" size="sm" icon={<Camera aria-hidden />} disabled>
          Add photo
        </Button>
        <span className="text-z-caption text-z-fg-muted">Photo upload is coming soon.</span>
      </div>
    </div>
  );
}
