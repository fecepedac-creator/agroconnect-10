const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AbusePolicyError,
  assertPayloadWithinLimits,
  getRateLimitDecision,
  getRateWindow,
  normalizeRateLimitPolicy,
  parseAppCheckMode,
  validateActionName,
  validateIdempotencyKey,
} = require("../lib/abusePolicy.js");

test("accepts report and enforce as App Check modes", () => {
  assert.equal(parseAppCheckMode(undefined), "report");
  assert.equal(parseAppCheckMode("ENFORCE"), "enforce");
  assert.throws(
    () => parseAppCheckMode("disabled"),
    (error) => error instanceof AbusePolicyError &&
      error.reason === "invalid-app-check-mode"
  );
});

test("validates idempotency keys without accepting unsafe values", () => {
  assert.equal(
    validateIdempotencyKey("apply-01J123456789ABCDEF"),
    "apply-01J123456789ABCDEF"
  );
  assert.equal(validateIdempotencyKey(undefined, false), undefined);
  assert.throws(
    () => validateIdempotencyKey("short"),
    (error) => error.reason === "invalid-idempotency-key"
  );
  assert.throws(
    () => validateIdempotencyKey("unsafe key with spaces"),
    (error) => error.reason === "invalid-idempotency-key"
  );
});

test("validates stable action names", () => {
  assert.equal(validateActionName("apply-to-job"), "apply-to-job");
  assert.throws(
    () => validateActionName("Apply To Job"),
    (error) => error.reason === "invalid-action-name"
  );
});

test("measures valid payloads and rejects oversized strings", () => {
  const result = assertPayloadWithinLimits({jobId: "job-1", tags: ["a", "b"]});
  assert.ok(result.bytes > 0);
  assert.equal(result.nodes, 5);
  assert.equal(result.depth, 2);

  assert.throws(
    () => assertPayloadWithinLimits({message: "12345"}, {maxStringChars: 4}),
    (error) => error.reason === "payload-string-too-long"
  );
});

test("rejects deep, wide, large and cyclic payloads", () => {
  assert.throws(
    () => assertPayloadWithinLimits({a: {b: {c: true}}}, {maxDepth: 2}),
    (error) => error.reason === "payload-too-deep"
  );
  assert.throws(
    () => assertPayloadWithinLimits({a: 1, b: 2}, {maxObjectKeys: 1}),
    (error) => error.reason === "payload-object-too-large"
  );
  assert.throws(
    () => assertPayloadWithinLimits({value: "á"}, {maxBytes: 8}),
    (error) => error.reason === "payload-too-large"
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => assertPayloadWithinLimits(cyclic),
    (error) => error.reason === "payload-not-serializable"
  );
});

test("computes fixed windows and TTL expiration", () => {
  const window = getRateWindow(125_000, {
    limit: 3,
    windowSeconds: 60,
    ttlSeconds: 600,
  });
  assert.deepEqual(window, {
    startsAtMs: 120_000,
    expiresAtMs: 720_000,
  });
});

test("allows exactly the configured number of requests", () => {
  const policy = {limit: 2, windowSeconds: 60, ttlSeconds: 600};
  assert.deepEqual(getRateLimitDecision(0, policy), {
    allowed: true,
    nextCount: 1,
    remaining: 1,
  });
  assert.deepEqual(getRateLimitDecision(1, policy), {
    allowed: true,
    nextCount: 2,
    remaining: 0,
  });
  assert.deepEqual(getRateLimitDecision(2, policy), {
    allowed: false,
    nextCount: 2,
    remaining: 0,
  });
});

test("rejects unsafe rate limit configuration", () => {
  assert.throws(
    () => normalizeRateLimitPolicy({windowSeconds: 60, ttlSeconds: 30}),
    (error) => error.reason === "invalid-abuse-configuration"
  );
  assert.throws(
    () => normalizeRateLimitPolicy({limit: 0}),
    (error) => error.reason === "invalid-abuse-configuration"
  );
});
