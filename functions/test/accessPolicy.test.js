const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canBootstrapLegacyMembership,
  canManageCompanyMembership,
  hasActiveCompanyAuthority,
  isActiveCompany,
  isActiveCompanyMembership,
} = require("../lib/accessPolicy.js");

test("only active company roles grant company access", () => {
  assert.equal(isActiveCompanyMembership({status: "active", role: "company_admin"}), true);
  assert.equal(isActiveCompanyMembership({status: "active", role: "company_hr"}), true);
  assert.equal(isActiveCompanyMembership({status: "suspended", role: "company_admin"}), false);
  assert.equal(isActiveCompanyMembership({status: "active", role: "worker"}), false);
});

test("company authority requires both active membership and active company", () => {
  const activeMembership = {status: "active", role: "company_admin"};
  assert.equal(isActiveCompany({status: "active"}), true);
  assert.equal(isActiveCompany({status: "suspended"}), false);
  assert.equal(hasActiveCompanyAuthority(activeMembership, {status: "active"}), true);
  assert.equal(hasActiveCompanyAuthority(activeMembership, {status: "suspended"}), false);
  assert.equal(hasActiveCompanyAuthority(
    {status: "suspended", role: "company_admin"},
    {status: "active"}
  ), false);
});

test("only active admins can manage membership", () => {
  assert.equal(canManageCompanyMembership({status: "active", role: "company_admin"}), true);
  assert.equal(canManageCompanyMembership({status: "active", role: "company_hr"}), false);
  assert.equal(canManageCompanyMembership({status: "removed", role: "company_admin"}), false);
});

test("legacy bootstrap never reactivates an existing membership", () => {
  assert.equal(canBootstrapLegacyMembership(null), true);
  assert.equal(canBootstrapLegacyMembership({status: "removed"}), false);
  assert.equal(canBootstrapLegacyMembership({status: "suspended"}), false);
});
