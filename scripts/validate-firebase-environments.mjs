import { readFileSync } from 'node:fs';

const rawRc = readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const rc = JSON.parse(rawRc);
const requiredAliases = ['dev', 'staging', 'prod'];
const projects = rc.projects ?? {};
const errors = [];

for (const alias of requiredAliases) {
  const projectId = projects[alias];
  if (!projectId || projectId.startsWith('REPLACE_WITH_')) {
    errors.push(`Firebase alias "${alias}" is not configured.`);
  }
}

const configuredIds = requiredAliases.map((alias) => projects[alias]).filter(Boolean);
if (new Set(configuredIds).size !== configuredIds.length) {
  errors.push('Firebase dev, staging and prod must use different project IDs.');
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Firebase environment mapping is valid.');
