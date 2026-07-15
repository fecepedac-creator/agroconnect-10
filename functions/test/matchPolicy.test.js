const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canRespondToMatchState,
  isSelfDeclaredCredentialType,
  isTerminalMatchState,
  nextMatchState,
  parseCredentialDecision,
  parseMatchDecision,
} = require("../lib/matchPolicy.js");

test("rejects unknown match decisions instead of treating them as interested", () => {
  assert.equal(parseMatchDecision("anything"), null);
  assert.equal(parseMatchDecision(undefined), null);
  assert.equal(parseMatchDecision("interested"), "interested");
  assert.equal(parseMatchDecision("declined"), "declined");
});

test("treats declined and completed match states as terminal", () => {
  assert.equal(isTerminalMatchState("declined"), true);
  assert.equal(isTerminalMatchState("hired"), true);
  assert.equal(isTerminalMatchState("matched"), false);
});

test("accepts decisions only before mutual match", () => {
  assert.equal(canRespondToMatchState("worker_interested"), true);
  assert.equal(canRespondToMatchState("company_interested"), true);
  assert.equal(canRespondToMatchState("matched"), false);
  assert.equal(canRespondToMatchState("declined"), false);
});

test("requires mutual interest to create a match", () => {
  assert.equal(nextMatchState("interested", "pending"), "worker_interested");
  assert.equal(nextMatchState("pending", "interested"), "company_interested");
  assert.equal(nextMatchState("interested", "interested"), "matched");
});

test("validates credential decisions and self-declared types", () => {
  assert.equal(parseCredentialDecision("invalid"), null);
  assert.equal(parseCredentialDecision("verified"), "verified");
  assert.equal(isSelfDeclaredCredentialType("os10"), true);
  assert.equal(isSelfDeclaredCredentialType("company_training"), false);
});
