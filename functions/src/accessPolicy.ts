export function isActiveCompanyMembership(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const membership = data as {status?: unknown; role?: unknown};
  return membership.status === "active" &&
    (membership.role === "company_admin" || membership.role === "company_hr");
}

export function canManageCompanyMembership(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const membership = data as {status?: unknown; role?: unknown};
  return membership.status === "active" && membership.role === "company_admin";
}

export function canBootstrapLegacyMembership(existingMembership: unknown): boolean {
  return existingMembership === null || existingMembership === undefined;
}
