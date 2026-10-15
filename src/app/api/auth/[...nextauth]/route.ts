import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/google";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
