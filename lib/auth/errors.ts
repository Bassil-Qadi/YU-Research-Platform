import { CredentialsSignin } from "next-auth";

/**
 * Auth.js puts `code` in the `?code=` query param of the sign-in redirect, which
 * `signIn(..., { redirect: false })` returns to the client. Codes must therefore
 * never reveal anything the caller could not already work out for themselves.
 */

/** Wrong password, unknown account, or an account with no password set. */
export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

/** Correct password, but an admin has not approved the account yet. */
export class AccountPendingError extends CredentialsSignin {
  code = "account_pending";
}

/** Correct password, but an admin rejected the registration. */
export class AccountRejectedError extends CredentialsSignin {
  code = "account_rejected";
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  account_pending:
    "Your account is pending admin approval. You will be notified once approved.",
  account_rejected:
    "Your registration was not approved. Please contact the university admin.",
};

export const DEFAULT_AUTH_ERROR_MESSAGE = "Unable to sign in. Please try again.";
