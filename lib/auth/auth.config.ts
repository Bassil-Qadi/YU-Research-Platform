import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types";

/** Edge-safe config — no Mongoose or DB imports (used by middleware) */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/projects") ||
        pathname.startsWith("/messages") ||
        pathname.startsWith("/directory") ||
        pathname.startsWith("/profile") ||
        pathname.startsWith("/admin");

      if (isProtected) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole | undefined;
        token.universityId = user.universityId;
        token.department = user.department;
        token.sub = (user as any)._id?.toString() ?? token.sub
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? "Guest";
        session.user.universityId = token.universityId as string | undefined;
        session.user.department = token.department as string | undefined;
      }
      return session;
    },
  },
  providers: [],
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
