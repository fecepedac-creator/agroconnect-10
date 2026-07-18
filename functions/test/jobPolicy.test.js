const test = require("node:test");
const assert = require("node:assert/strict");
const {evaluateEligibility} = require("../lib/jobPolicy.js");

const eligibleInput = {
  company: {status: "active"},
  job: {
    isActive: true,
    jobStatus: "active",
    workersNeeded: 2,
    workersFilled: 1,
    sector: "security",
    requiresOs10: true,
  },
  worker: {
    available: true,
    discoverable: true,
    sectors: ["security"],
    os10Status: "valid",
    consent: {matching: true},
  },
};

test("accepts an eligible worker for an open job", () => {
  assert.deepEqual(evaluateEligibility(eligibleInput), {
    eligible: true,
    reasons: [],
    policyVersion: 1,
  });
});

test("rejects capacity, consent, sector and OS10 failures explicitly", () => {
  const result = evaluateEligibility({
    company: {status: "active"},
    job: {...eligibleInput.job, workersFilled: 2},
    worker: {
      available: false,
      discoverable: false,
      sectors: ["agriculture"],
      os10Status: "expired",
      consent: {matching: false},
    },
  });

  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, [
    "job_full",
    "worker_unavailable",
    "matching_consent_required",
    "sector_mismatch",
    "os10_required",
  ]);
});

test("requires every configured active credential", () => {
  const result = evaluateEligibility({
    ...eligibleInput,
    job: {
      ...eligibleInput.job,
      requiredCredentialTypes: ["os10", "platform_course"],
    },
    credentials: [
      {credentialType: "os10", status: "active"},
      {credentialType: "platform_course", status: "pending"},
    ],
  });

  assert.deepEqual(result.reasons, ["credential_required"]);
});
