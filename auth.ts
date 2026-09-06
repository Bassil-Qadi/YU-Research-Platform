import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { authConfig } from "@/lib/auth/auth.config";
import clientPromise from "@/lib/auth/mongodb-client";
import { getAuthProviders } from "@/lib/auth/providers";
import { revalidateToken } from "@/lib/auth/revalidate";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  providers: getAuthProviders(),
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      // Sign-in has just read the account, so only re-check established tokens.
      return params.user ? { ...token, checkedAt: Date.now() } : revalidateToken(token);
    },
  },
});
