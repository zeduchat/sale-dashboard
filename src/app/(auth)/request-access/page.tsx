import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RequestAccessForm } from "@/components/auth/RequestAccessForm";

export const metadata = { title: "Request access" };

export default function RequestAccessPage() {
  return (
    <AuthCard
      title="Request access"
      description="Access is by invite only. Tell us who you are and an admin will get back to you."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-z-fg-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RequestAccessForm />
    </AuthCard>
  );
}
