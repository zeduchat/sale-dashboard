import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

/**
 * NextAuth is only the Google OAuth handshake. A verified Google account signs in the existing user with
 * that email, or creates a new MEMBER (the User.role default). Deactivated users are refused.
 * /api/auth/google/complete then swaps the NextAuth session for the app's own JWT + refresh cookies,
 * so there is a single session system.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Safe for Google: it only returns verified emails, and it lets a user who signed up by invite link their Google account.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email || (profile as { email_verified?: boolean } | undefined)?.email_verified === false) return false;
      const existing = await prisma.user.findFirst({ where: { email: { equals: user.email, mode: "insensitive" } } });
      return !existing?.disabledAt;
    },
    session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
};
