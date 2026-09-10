import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { authConfig } from "@/lib/auth/auth.config";
import clientPromise from "@/lib/auth/mongodb-client";
import { getAuthProviders } from "@/lib/auth/providers";
import { revalidateToken } from "@/lib/auth/revalidate";
import { completeAdapterUser, isApproved, oauthSignInAllowed } from "@/lib/auth/oauth";
import type { UserRole } from "@/types";

const isOAuth = (provider?: string) =>
  Boolean(provider) && provider !== "credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  providers: getAuthProviders(),
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // authorize() has already vetted a credentials sign-in.
      if (!isOAuth(account?.provider)) return true;

      // Turns an unapproved returning user away with a clear error instead of
      // handing them a session that revalidation would revoke moments later.
      return oauthSignInAllowed(user.id);
    },

    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);

      if (!params.user) return revalidateToken(token);

      // A fresh OAuth sign-in: the adapter has just created the record, so this
      // is the first point at which it can be completed and checked.
      if (isOAuth(params.account?.provider) && params.user.id) {
        const user = await completeAdapterUser(params.user.id);
        if (!isApproved(user)) return null;

        return {
          ...token,
          id:           params.user.id,
          role:         user?.role as UserRole | undefined,
          universityId: user?.universityId ?? undefined,
          department:   user?.department ?? undefined,
          checkedAt:    Date.now(),
        };
      }

      return { ...token, checkedAt: Date.now() };
    },
  },
});
