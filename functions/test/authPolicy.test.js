const test = require("node:test");
const assert = require("node:assert/strict");
const {isVerifiedGoogleIdentity} = require("../lib/authPolicy");

test("accepts a verified Google identity", () => {
  assert.equal(isVerifiedGoogleIdentity({
    email: "admin@example.com",
    email_verified: true,
    firebase: {sign_in_provider: "google.com"},
  }), true);
});

test("rejects an unverified Google identity", () => {
  assert.equal(isVerifiedGoogleIdentity({
    email: "admin@example.com",
    email_verified: false,
    firebase: {sign_in_provider: "google.com"},
  }), false);
});

test("rejects a password identity even when email is marked verified", () => {
  assert.equal(isVerifiedGoogleIdentity({
    email: "admin@example.com",
    email_verified: true,
    firebase: {sign_in_provider: "password"},
  }), false);
});
