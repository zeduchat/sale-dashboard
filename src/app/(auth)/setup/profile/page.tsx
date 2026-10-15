import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ProfileSetupForm } from "@/components/auth/ProfileSetupForm";
import { SETUP_COOKIE } from "@/lib/auth/config";
import { verifySetupToken } from "@/lib/auth/jwt";
import { inviteStatus } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function SetupProfilePage() {
  // Only reachable after a valid code was entered on /setup.
  const setup = await verifySetupToken(cookies().get(SETUP_COOKIE)?.value);
  if (!setup) redirect("/setup");
  const invite = await prisma.invite.findUnique({ where: { id: setup.inviteId } });
  if (!invite || inviteStatus(invite) !== "PENDING") redirect("/setup");

  return (
    <AuthCard title="Create your profile" description="Last step. Add your details and choose a password.">
      <ProfileSetupForm lockedEmail={invite.email} />
    </AuthCard>
  );
}
