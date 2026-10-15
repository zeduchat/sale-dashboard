import type { ReactNode } from "react";

// Signed-out screens (login, setup, request access). ZEDU v2 surface; no app shell.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="zedu grid min-h-screen place-items-center bg-z-app px-4 py-10">{children}</div>;
}
