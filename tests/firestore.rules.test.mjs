import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'agroconnect-rules-tests';
const COMPANY_ID = 'company_1';
const JOB_ID = 'job_1';
const APP_ID = 'app_1';
const APP_PATH = `companies/${COMPANY_ID}/jobs/${JOB_ID}/applications/${APP_ID}`;

let testEnv;

function workerDb(uid, email) {
  return testEnv.authenticatedContext(uid, { sub: uid, email }).firestore();
}

function companyAdminDb() {
  return testEnv.authenticatedContext('companyAdminA', {
    sub: 'companyAdminA',
    email: 'companyadmin@example.com',
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

  results.push(await runCase('legit: Worker can read own username mapping', async () => {
    const db = workerDb('workerA', 'workera@example.com');
    await assertSucceeds(getDoc(doc(db, 'worker_usernames', 'rut-worker-a')));
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

