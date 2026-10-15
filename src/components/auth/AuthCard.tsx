import type { ReactNode } from "react";
import { Card, Logo } from "@/components/zedu";

type Props = { title: string; description?: string; children: ReactNode; footer?: ReactNode };

/** Centered card shared by every signed-out screen (login, setup, request access). */
export function AuthCard({ title, description, children, footer }: Props) {
  return (
    <div className="flex w-full max-w-[420px] flex-col items-stretch gap-5">
      <Logo className="self-center" />
      <Card className="!gap-5 !p-6 max-sm:!p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-z-page text-z-fg">{title}</h1>
          {description && <p className="text-z-small text-z-fg-muted">{description}</p>}
        </div>
        {children}
      </Card>
      {footer && <p className="text-center text-z-small text-z-fg-muted">{footer}</p>}
    </div>
  );
}
