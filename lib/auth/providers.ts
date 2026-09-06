import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations/user";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import {
  AccountPendingError,
  AccountRejectedError,
  InvalidCredentialsError,
  TooManyAttemptsError,
} from "@/lib/auth/errors";
import { RATE_LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import type { UserRole } from "@/types";

/** Keep in sync with the cost used in /api/auth/register. */
const BCRYPT_ROUNDS = 12;

/**
 * Comparing against a real hash when no account matches keeps "unknown email"
 * and "wrong password" indistinguishable by response time, so the login form
 * cannot be used to enumerate accounts. Built on first miss, then reused.
 */
let placeholderHash: string | null = null;
function getPlaceholderHash(): string {
  if (!placeholderHash) {
    placeholderHash = bcrypt.hashSync("timing-equalisation-placeholder", BCRYPT_ROUNDS);
  }
  return placeholderHash;
}

export function getAuthProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      id: "credentials",
      name: "University credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentialsError();

        const email = parsed.data.email.toLowerCase();

        // Throttle by address and by origin: the first slows an attack on one
        // account, the second slows one attacker working through many.
        const ip = request instanceof Request ? clientIp(request) : "unknown";
        for (const key of [`login:email:${email}`, `login:ip:${ip}`]) {
          const verdict = await rateLimit(key, RATE_LIMITS.login);
          if (!verdict.allowed) throw new TooManyAttemptsError();
        }

        await connectDB();
        const user = await User.findOne({ email }).select("+passwordHash");

        // No account, or an account created through OAuth that has no password.
        if (!user?.passwordHash) {
          await bcrypt.compare(parsed.data.password, getPlaceholderHash());
          throw new InvalidCredentialsError();
        }

        const passwordMatches = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!passwordMatches) throw new InvalidCredentialsError();

        // Only reveal account status once the password has been proven.
        if (user.status === "pending") throw new AccountPendingError();
        if (user.status === "rejected") throw new AccountRejectedError();

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? user.avatar ?? undefined,
          role: user.role as UserRole,
          universityId: user.universityId,
          department: user.department ?? undefined,
        };
      },
    }),
  ];

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
