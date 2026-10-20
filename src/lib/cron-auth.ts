/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; fail closed if it's unset. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
