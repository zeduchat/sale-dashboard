import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { TokenForm } from "@/components/auth/TokenForm";

export const metadata = { title: "Set up your account" };

export default function SetupPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthCard
      title="Set up your account"
      description="Enter the setup code from your invite to get started."
      footer={
        <>
          Don&apos;t have a code?{" "}
          <Link href="/request-access" className="font-medium text-z-fg-accent hover:underline">
            Request access
          </Link>
        </>
      }
    >
      <TokenForm initialToken={typeof searchParams.token === "string" ? searchParams.token.slice(0, 16) : ""} />
    </AuthCard>
  );
}
