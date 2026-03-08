// Ensure elevated claims are preserved while updating
if (auth.getUser().roles.includes('superadmin')) {
    // Preserve elevated claims
    updatedClaims.admin = currentClaims.admin;
    updatedClaims.superadmin = currentClaims.superadmin;
} else {
    // Only update role and companyId claims if caller is NOT a superadmin
    updatedClaims.role = newRole;
    updatedClaims.companyId = newCompanyId;
}
// other claim updates continue here...