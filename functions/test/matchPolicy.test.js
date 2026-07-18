const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canProposeCompletion,
  canProposeHire,
  canRespondToCompletion,
  canRespondToHire,
  canReviewMatch,
  canRespondToMatchState,
  isSelfDeclaredCredentialType,
  isTerminalMatchState,
  nextMatchState,
  parseCredentialDecision,
  parseCompletionDecision,
  parseHireDecision,
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
  assert.equal(isTerminalMatchState("hire_proposed"), true);
  assert.equal(isTerminalMatchState("completion_proposed"), true);
  assert.equal(isTerminalMatchState("completed"), true);
});

test("defines bilateral hiring transitions", () => {
  assert.equal(canProposeHire("matched"), true);
  assert.equal(canProposeHire("hired"), false);
  assert.equal(canRespondToHire("hire_proposed"), true);
  assert.equal(canRespondToHire("matched"), false);
  assert.equal(parseHireDecision("accept"), "accept");
  assert.equal(parseHireDecision("reject"), "reject");
  assert.equal(parseHireDecision("yes"), null);
});

test("defines bilateral completion and review transitions", () => {
  assert.equal(canProposeCompletion("hired"), true);
  assert.equal(canProposeCompletion("completion_disputed"), true);
  assert.equal(canRespondToCompletion("completion_proposed"), true);
  assert.equal(parseCompletionDecision("confirm"), "confirm");
  assert.equal(parseCompletionDecision("dispute"), "dispute");
  assert.equal(parseCompletionDecision("done"), null);
  assert.equal(canReviewMatch("completed", false), true);
  assert.equal(canReviewMatch("closed", true), true);
  assert.equal(canReviewMatch("closed", false), false);
  assert.equal(canReviewMatch("hired", false), false);
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
