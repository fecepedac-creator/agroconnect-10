import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'agroconnect-rules-tests';
const COMPANY_ID = 'company_1';
const JOB_ID = 'job_1';
const APP_ID = 'app_1';
const APP_PATH = `companies/${COMPANY_ID}/jobs/${JOB_ID}/applications/${APP_ID}`;
const COMPANY_APP_PATH = `companies/${COMPANY_ID}/jobs/${JOB_ID}/applications/workerA`;
const WORKER_APP_ID = `${COMPANY_ID}_${JOB_ID}`;
const WORKER_APP_PATH = `workers/workerA/applications/${WORKER_APP_ID}`;

let testEnv;

function workerDb(uid, email) {
  return testEnv.authenticatedContext(uid, { sub: uid, email }).firestore();
}

function companyAdminDb() {
  return testEnv.authenticatedContext('companyAdminA', {
    sub: 'companyAdminA',
    email: 'companyadmin@example.com',
    role: 'company_admin',
    companyId: COMPANY_ID,
  }).firestore();
}

function removedCompanyMemberDb() {
  return testEnv.authenticatedContext('removedCompanyMember', {
    sub: 'removedCompanyMember',
    email: 'removed@example.com',
    role: 'company_admin',
    companyId: COMPANY_ID,
  }).firestore();
}

function superAdminDb() {
  return testEnv.authenticatedContext('superAdmin', {
    sub: 'superAdmin',
    email: 'superadmin@example.com',
    admin: true,
    superadmin: true,
    role: 'superadmin',
  }).firestore();
}

function companyDb(uid) {
  return testEnv.authenticatedContext(uid, { sub: uid }).firestore();
}

function validApplicationPayload(overrides = {}) {
  return {
    workerId: 'workerA',
    companyId: COMPANY_ID,
    jobId: JOB_ID,
    jobTitle: 'Operario de bodega',
    companyName: 'Empresa activa',
    appliedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    status: 'postulado',
    ...overrides,
  };
}

async function seedBaseData() {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'users', 'workerA'), {
      role: 'worker',
      email: 'workera@example.com',
      companyId: null,
    });

    await setDoc(doc(db, 'users', 'workerB'), {
      role: 'worker',
      email: 'workerb@example.com',
      companyId: null,
    });

    await setDoc(doc(db, 'users', 'companyAdminA'), {
      role: 'company_admin',
      email: 'companyadmin@example.com',
      companyId: COMPANY_ID,
    });

    await setDoc(doc(db, 'users', 'companyMemberA'), {
      role: 'worker',
      email: 'member@example.com',
      companyId: null,
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'company_members', 'companyAdminA'), {
      uid: 'companyAdminA',
      companyId: COMPANY_ID,
      email: 'companyadmin@example.com',
      role: 'company_admin',
      status: 'active',
      schemaVersion: 1,
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'company_members', 'companyMemberA'), {
      uid: 'companyMemberA',
      companyId: COMPANY_ID,
      email: 'member@example.com',
      role: 'company_hr',
      status: 'active',
      schemaVersion: 1,
    });

    await setDoc(doc(db, 'users', 'removedCompanyMember'), {
      role: 'company_admin',
      email: 'removed@example.com',
      companyId: COMPANY_ID,
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'company_members', 'removedCompanyMember'), {
      uid: 'removedCompanyMember',
      companyId: COMPANY_ID,
      email: 'removed@example.com',
      role: 'company_admin',
      status: 'removed',
      schemaVersion: 1,
    });

    await setDoc(doc(db, 'users', 'companyAdminOverdue'), {
      role: 'company_admin',
      email: 'overdue@example.com',
      companyId: 'company_overdue',
    });

    await setDoc(doc(db, 'users', 'companyAdminSuspended'), {
      role: 'company_admin',
      email: 'suspended@example.com',
      companyId: 'company_suspended',
    });

    await setDoc(doc(db, 'companies', 'company_overdue', 'company_members', 'companyAdminOverdue'), {
      uid: 'companyAdminOverdue',
      companyId: 'company_overdue',
      email: 'overdue@example.com',
      role: 'company_admin',
      status: 'active',
      schemaVersion: 1,
    });

    await setDoc(doc(db, 'companies', 'company_suspended', 'company_members', 'companyAdminSuspended'), {
      uid: 'companyAdminSuspended',
      companyId: 'company_suspended',
      email: 'suspended@example.com',
      role: 'company_admin',
      status: 'active',
      schemaVersion: 1,
    });

    await setDoc(doc(db, 'companies', COMPANY_ID), {
      name: 'Empresa activa',
      status: 'active',
      subscriptionPlan: 'Basic',
    });

    await setDoc(doc(db, 'companies', 'company_overdue'), {
      name: 'Empresa morosa',
      status: 'overdue',
      subscriptionPlan: 'Basic',
    });

    await setDoc(doc(db, 'companies', 'company_suspended'), {
      name: 'Empresa suspendida',
      status: 'suspended',
      subscriptionPlan: 'Basic',
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'jobs', JOB_ID), {
      companyId: COMPANY_ID,
      title: 'Operario de bodega',
      isDraft: false,
      isActive: true,
      jobStatus: 'active',
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'jobs', 'job_inactive'), {
      companyId: COMPANY_ID,
      title: 'Oferta cerrada',
      isDraft: false,
      isActive: false,
      jobStatus: 'closed',
    });

    await setDoc(doc(db, 'companies', 'company_overdue', 'jobs', 'job_active'), {
      companyId: 'company_overdue',
      title: 'Oferta publicada antes de la morosidad',
      isDraft: false,
      isActive: true,
      jobStatus: 'active',
    });

    await setDoc(doc(db, 'publicWorkers', 'workerA'), {
      name: 'Trabajador A',
      phone: '+56911111111',
      email: 'workera@example.com',
      isAvailable: true,
    });

    await setDoc(doc(db, 'discoverableWorkers', 'workerA'), {
      workerId: 'workerA',
      displayName: 'Trabajador A.',
      region: 'Maule',
      skills: ['Poda'],
      isAvailable: true,
      updatedAt: Timestamp.now(),
      schemaVersion: 2,
    });

    await setDoc(doc(db, 'matches', 'match_1'), {
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      workerId: 'workerA',
      state: 'matched',
      workerDecision: 'interested',
      companyDecision: 'interested',
      updatedAt: Timestamp.now(),
    });

    await setDoc(doc(db, 'match_reviews', 'match_1_company_to_worker'), {
      matchId: 'match_1',
      companyId: COMPANY_ID,
      workerId: 'workerA',
      side: 'company_to_worker',
      authorUid: 'companyMemberA',
      visible: false,
    });

    await setDoc(doc(db, 'match_reviews', 'match_1_worker_to_company'), {
      matchId: 'match_1',
      companyId: COMPANY_ID,
      workerId: 'workerA',
      side: 'worker_to_company',
      authorUid: 'workerA',
      visible: false,
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'contact_grants', 'match_1'), {
      companyId: COMPANY_ID,
      workerId: 'workerA',
      matchId: 'match_1',
      status: 'active',
      contact: { phone: '+56911111111' },
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    });

    await setDoc(doc(db, 'worker_credentials', 'credential_1'), {
      workerId: 'workerA',
      title: 'Poda básica',
      status: 'active',
      visibility: 'public',
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_1'), {
      amount: 100000,
      status: 'paid',
    });

    await setDoc(doc(db, 'companies', COMPANY_ID, 'billing_invoices', 'invoice_1'), {
      amount: 100000,
      status: 'unpaid',
    });

    await setDoc(doc(db, 'worker_usernames', 'rut-worker-a'), {
      uid: 'workerA',
      email: 'workera@example.com',
    });

    await setDoc(doc(db, 'worker_usernames', 'rut-worker-b'), {
      uid: 'workerB',
      email: 'workerb@example.com',
    });

    await setDoc(doc(db, APP_PATH), {
      workerId: 'workerA',
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      status: 'applied',
      attendanceStatus: 'pending',
      createdAt: 1,
      decisionBy: null,
      decisionAt: null,
      note: 'initial-note',
    });
  });
}

async function runCase(name, fn) {
  try {
    await seedBaseData();
    await fn();
    console.log(`PASS: ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err?.message || err);
    return false;
  }
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const results = [];

  results.push(await runCase('abuse: Worker A cannot read Worker B username mapping', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(getDoc(doc(db, 'worker_usernames', 'rut-worker-b')));
  }));

  results.push(await runCase('abuse: Worker A cannot create mapping for an existing rut', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(
      setDoc(doc(db, 'worker_usernames', 'rut-worker-b'), {
        uid: 'workerA',
        email: 'workera@example.com',
      })
    );
  }));

  results.push(await runCase('abuse: Owner cannot change email in worker username mapping', async () => {
    const db = workerDb('workerB', 'workerb@example.com');
    await assertFails(updateDoc(doc(db, 'worker_usernames', 'rut-worker-b'), { email: 'new@example.com' }));
  }));

  results.push(await runCase('abuse: Worker cannot update application status', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(updateDoc(doc(db, APP_PATH), { status: 'hired' }));
  }));

  results.push(await runCase('abuse: Worker cannot update attendanceStatus in application', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(updateDoc(doc(db, APP_PATH), { attendanceStatus: 'confirmed' }));
  }));

  results.push(await runCase('abuse: Company cannot read public worker PII', async () => {
    const db = companyAdminDb();
    await assertFails(getDoc(doc(db, 'publicWorkers', 'workerA')));
  }));

  results.push(await runCase('legit: Company can read privacy-safe worker discovery data', async () => {
    const db = companyAdminDb();
    await assertSucceeds(getDoc(doc(db, 'discoverableWorkers', 'workerA')));
  }));

  results.push(await runCase('abuse: Removed member cannot use stale claims to read company data', async () => {
    const db = removedCompanyMemberDb();
    await assertFails(getDoc(doc(db, 'matches', 'match_1')));
    await assertFails(getDoc(doc(db, 'discoverableWorkers', 'workerA')));
    await assertFails(getDoc(doc(db, 'companies', COMPANY_ID, 'billing_invoices', 'invoice_1')));
  }));

  results.push(await runCase('abuse: Company cannot write worker discovery data', async () => {
    const db = companyAdminDb();
    await assertFails(updateDoc(doc(db, 'discoverableWorkers', 'workerA'), { displayName: 'Alterado' }));
  }));

  results.push(await runCase('legit: Match participants can read the match', async () => {
    await assertSucceeds(getDoc(doc(workerDb('workerA', 'workera@example.com'), 'matches', 'match_1')));
    await assertSucceeds(getDoc(doc(companyAdminDb(), 'matches', 'match_1')));
  }));

  results.push(await runCase('abuse: Unrelated worker cannot read a match', async () => {
    await assertFails(getDoc(doc(workerDb('workerB', 'workerb@example.com'), 'matches', 'match_1')));
  }));

  results.push(await runCase('abuse: Clients cannot write canonical matches', async () => {
    await assertFails(updateDoc(doc(companyAdminDb(), 'matches', 'match_1'), { state: 'hired' }));
  }));

  results.push(await runCase('legit: Company members share their company review state', async () => {
    const db = companyDb('companyMemberA');
    await assertSucceeds(getDoc(doc(db, 'match_reviews', 'match_1_company_to_worker')));
  }));

  results.push(await runCase('abuse: Double blind hides worker review until it is revealed', async () => {
    await assertFails(getDoc(doc(companyAdminDb(), 'match_reviews', 'match_1_worker_to_company')));
    await assertSucceeds(getDoc(doc(workerDb('workerA', 'workera@example.com'), 'match_reviews', 'match_1_worker_to_company')));
  }));

  results.push(await runCase('legit: Company can read contact only after an active grant', async () => {
    await assertSucceeds(getDoc(doc(companyAdminDb(), 'companies', COMPANY_ID, 'contact_grants', 'match_1')));
  }));

  results.push(await runCase('legit: Company can read public verified credentials', async () => {
    await assertSucceeds(getDoc(doc(companyAdminDb(), 'worker_credentials', 'credential_1')));
  }));

  results.push(await runCase('abuse: Company cannot issue credentials from the browser', async () => {
    await assertFails(setDoc(doc(companyAdminDb(), 'worker_credentials', 'credential_fake'), {
      workerId: 'workerA',
      title: 'Falsa',
      status: 'active',
      visibility: 'public',
    }));
  }));

  results.push(await runCase('abuse: Company cannot create billing payments', async () => {
    const db = companyAdminDb();
    await assertFails(setDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_2'), { amount: 1 }));
  }));

  results.push(await runCase('abuse: Company cannot update billing invoices', async () => {
    const db = companyAdminDb();
    await assertFails(updateDoc(doc(db, 'companies', COMPANY_ID, 'billing_invoices', 'invoice_1'), { status: 'paid' }));
  }));

  results.push(await runCase('abuse: Company cannot delete billing payments', async () => {
    const db = companyAdminDb();
    await assertFails(deleteDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_1')));
  }));

  results.push(await runCase('abuse: Application companyId must match its path', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload({ companyId: 'other_company' })));
  }));

  results.push(await runCase('abuse: Application jobId must match its path', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload({ jobId: 'other_job' })));
  }));

  results.push(await runCase('abuse: Company application id must be the worker id', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(
      doc(db, `companies/${COMPANY_ID}/jobs/${JOB_ID}/applications/${WORKER_APP_ID}`),
      validApplicationPayload()
    ));
  }));

  results.push(await runCase('abuse: Worker application mirror id must be company and job', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(
      doc(db, 'workers/workerA/applications/workerA'),
      validApplicationPayload()
    ));
  }));

  results.push(await runCase('abuse: Application cannot start hired', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload({ status: 'hired' })));
  }));

  results.push(await runCase('abuse: Application rejects unexpected fields', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload({ adminApproved: true })));
  }));

  results.push(await runCase('abuse: Application rejects client timestamps', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload({ createdAt: new Date(0) })));
  }));

  results.push(await runCase('abuse: Application cannot target an inactive job', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(
      doc(db, `companies/${COMPANY_ID}/jobs/job_inactive/applications/workerA`),
      validApplicationPayload({ jobId: 'job_inactive' })
    ));
  }));

  results.push(await runCase('abuse: Worker application mirror enforces the same schema', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertFails(setDoc(doc(db, WORKER_APP_PATH), validApplicationPayload({ status: 'rejected' })));
  }));

  results.push(await runCase('abuse: Overdue company cannot publish a job', async () => {
    const db = companyDb('companyAdminOverdue');
    await assertFails(setDoc(doc(db, 'companies/company_overdue/jobs/job_new'), {
      title: 'Oferta bloqueada',
      isActive: true,
      jobStatus: 'active',
    }));
  }));

  results.push(await runCase('abuse: Suspended company cannot publish a job', async () => {
    const db = companyDb('companyAdminSuspended');
    await assertFails(setDoc(doc(db, 'companies/company_suspended/jobs/job_new'), {
      title: 'Oferta bloqueada',
      isActive: true,
      jobStatus: 'active',
    }));
  }));

  results.push(await runCase('abuse: Overdue company cannot keep an existing job published through updates', async () => {
    const db = companyDb('companyAdminOverdue');
    await assertFails(updateDoc(doc(db, 'companies/company_overdue/jobs/job_active'), {
      title: 'Intento de modificar oferta activa',
    }));
  }));

  results.push(await runCase('legit: Worker can read own username mapping', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(getDoc(doc(db, 'worker_usernames', 'rut-worker-a')));
  }));

  results.push(await runCase('legit: Worker can read own public worker document', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(getDoc(doc(db, 'publicWorkers', 'workerA')));
  }));

  results.push(await runCase('legit: Company can read own billing records', async () => {
    const db = companyAdminDb();
    await assertSucceeds(getDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_1')));
    await assertSucceeds(getDoc(doc(db, 'companies', COMPANY_ID, 'billing_invoices', 'invoice_1')));
  }));

  results.push(await runCase('abuse: Superadmin browser cannot write billing records', async () => {
    const db = superAdminDb();
    await assertFails(setDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_admin'), {
      amount: 50000,
      status: 'paid',
    }));
  }));

  results.push(await runCase('legit: Active company membership grants company access', async () => {
    const db = companyDb('companyMemberA');
    await assertSucceeds(getDoc(doc(db, 'companies', COMPANY_ID)));
    await assertSucceeds(getDoc(doc(db, 'companies', COMPANY_ID, 'billing_payments', 'payment_1')));
  }));

  results.push(await runCase('legit: Worker can create a valid job application', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(setDoc(doc(db, COMPANY_APP_PATH), validApplicationPayload()));
  }));

  results.push(await runCase('legit: Two workers can apply to the same job without collision', async () => {
    const workerA = workerDb('workerA', 'workera@example.com');
    const workerB = workerDb('workerB', 'workerb@example.com');
    const workerARef = doc(workerA, COMPANY_APP_PATH);
    const workerBRef = doc(workerB, `companies/${COMPANY_ID}/jobs/${JOB_ID}/applications/workerB`);

    await assertSucceeds(setDoc(workerARef, validApplicationPayload()));
    await assertSucceeds(setDoc(workerBRef, validApplicationPayload({ workerId: 'workerB' })));
    await assertSucceeds(getDoc(workerARef));
    await assertSucceeds(getDoc(workerBRef));
  }));

  results.push(await runCase('legit: Worker can create the valid application mirror', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(setDoc(doc(db, WORKER_APP_PATH), validApplicationPayload()));
  }));

  results.push(await runCase('legit: Active company can publish a job', async () => {
    const db = companyAdminDb();
    await assertSucceeds(setDoc(doc(db, 'companies', COMPANY_ID, 'jobs', 'job_new'), {
      title: 'Oferta permitida',
      isActive: true,
      jobStatus: 'active',
    }));
  }));

  results.push(await runCase('legit: Suspended company can save a non-published draft', async () => {
    const db = companyDb('companyAdminSuspended');
    await assertSucceeds(setDoc(doc(db, 'companies/company_suspended/jobs/job_draft'), {
      title: 'Borrador permitido',
      isDraft: true,
      isActive: false,
      jobStatus: 'draft',
    }));
  }));

  results.push(await runCase('legit: Worker can create initial username mapping for new rut', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(
      setDoc(doc(db, 'worker_usernames', 'rut-worker-a-new'), {
        uid: 'workerA',
        email: 'workera@example.com',
      })
    );
  }));

  results.push(await runCase('legit: Worker can update non-sensitive application fields', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(updateDoc(doc(db, APP_PATH), { note: 'worker-note-update' }));
  }));

  results.push(await runCase('legit: Company admin can update application status', async () => {
    const db = companyAdminDb();
    await assertSucceeds(updateDoc(doc(db, APP_PATH), { status: 'hired' }));
  }));

  results.push(await runCase('legit: Superadmin can update application status', async () => {
    const db = superAdminDb();
    await assertSucceeds(updateDoc(doc(db, APP_PATH), { status: 'hired' }));
  }));

  await testEnv.cleanup();

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  console.log(`Summary: ${passed} passed / ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

