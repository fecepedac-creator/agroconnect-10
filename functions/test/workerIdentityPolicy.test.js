const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertRutClaimAvailable,
  assertTokenEmail,
  normalizeChileanRut,
} = require("../lib/workerIdentityPolicy.js");

test("normalizes a valid Chilean RUT and rejects a wrong check digit", () => {
  assert.equal(normalizeChileanRut("12.345.678-5"), "123456785");
  assert.throws(
    () => normalizeChileanRut("12.345.678-4"),
    /dígito verificador/i
  );
});

test("allows an idempotent RUT claim by its owner", () => {
  assert.doesNotThrow(() => assertRutClaimAvailable(null, "workerA"));
  assert.doesNotThrow(() => assertRutClaimAvailable({uid: "workerA"}, "workerA"));
});

test("rejects a RUT collision with another uid", () => {
  assert.throws(
    () => assertRutClaimAvailable({uid: "workerB"}, "workerA"),
    (error) => error.code === "already-exists"
  );
});

test("accepts only a bounded valid token email", () => {
  assert.equal(assertTokenEmail(" Worker@Example.COM "), "worker@example.com");
  assert.throws(() => assertTokenEmail("not-an-email"), /correo válido/i);
});
