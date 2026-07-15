export type AuthTokenLike = {
  email?: unknown;
  email_verified?: unknown;
  firebase?: {
    sign_in_provider?: unknown;
  };
};

export function isVerifiedGoogleIdentity(token: AuthTokenLike | null | undefined): boolean {
  return Boolean(
    token?.email &&
    token.email_verified === true &&
    token.firebase?.sign_in_provider === "google.com"
  );
}
