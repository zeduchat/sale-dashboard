import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/auth/http";

export const metadata = { title: "Sign in" };

type Props = { searchParams: { next?: string; error?: string } };

export default function LoginPage({ searchParams }: Props) {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to see your calls, leads and follow-ups."
      footer={
        <>
          No account?{" "}
          <Link href="/request-access" className="font-medium text-z-fg-accent hover:underline">
            Request access
          </Link>
        </>
      }
    >
      <LoginForm next={safeNext(searchParams.next)} oauthError={searchParams.error} />
    </AuthCard>
  );
}
