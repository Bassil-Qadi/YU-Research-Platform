import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations/user";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import type { UserRole } from "@/types";

const devAuthEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_AUTH_ENABLED !== "false";

async function ensureDevUser(email: string, password: string) {
  await connectDB();
  const devEmail =
    process.env.DEV_USER_EMAIL ?? "demo@university.edu";
  const devPassword =
    process.env.DEV_USER_PASSWORD ?? "demo123456";

  if (email !== devEmail || password !== devPassword) {
    return null;
  }

  let user = await User.findOne({ email: devEmail }).select("+passwordHash");

  if (!user) {
    const passwordHash = await bcrypt.hash(devPassword, 10);
    user = await User.create({
      universityId: "DEV-001",
      email: devEmail,
      name: "Demo Researcher",
      role: "Admin" as UserRole,
      department: "Computer Science",
      researchInterests: ["collaboration", "open science"],
      passwordHash,
    });
  }

  return user;
}

export function getAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (devAuthEnabled) {
    providers.push(
      Credentials({
        id: "credentials",
        name: "Development Login",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password } = parsed.data;
          const user = await ensureDevUser(email, password);
          if (!user) return null;

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.avatar ?? undefined,
            role: user.role as UserRole,
            universityId: user.universityId,
            department: user.department ?? undefined,
          };
        },
      })
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    );
  }

  // SAML / university SSO: configure via env when IdP is ready (Phase 2+)
  // See .env.example: SAML_ENABLED, SAML_IDP_METADATA_URL, etc.

  return providers;
}
