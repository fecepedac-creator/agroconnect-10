import { readFileSync } from 'node:fs';

const rawRc = readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const rc = JSON.parse(rawRc);
const requiredAliases = ['dev', 'staging', 'prod'];
const projects = rc.projects ?? {};
const selectedEnvironment = process.env.FIREBASE_ENVIRONMENT?.trim();
const aliasesToValidate = selectedEnvironment ? [selectedEnvironment] : requiredAliases;
const errors = [];

if (selectedEnvironment && !requiredAliases.includes(selectedEnvironment)) {
  errors.push('FIREBASE_ENVIRONMENT must be dev, staging or prod.');
}

const resolvedProjects = Object.fromEntries(requiredAliases.map((alias) => {
  const environmentName = `FIREBASE_PROJECT_ID_${alias.toUpperCase()}`;
  return [alias, process.env[environmentName]?.trim() || projects[alias]];
}));

for (const alias of aliasesToValidate) {
  const projectId = resolvedProjects[alias];
  if (!projectId || projectId.startsWith('REPLACE_WITH_')) {
    errors.push(`Firebase alias "${alias}" is not configured.`);
    continue;
  }

  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    errors.push(`Firebase alias "${alias}" does not contain a valid project ID.`);
  }
}

if (!selectedEnvironment) {
  const configuredIds = requiredAliases
    .map((alias) => resolvedProjects[alias])
    .filter((projectId) => projectId && !projectId.startsWith('REPLACE_WITH_'));
  if (new Set(configuredIds).size !== configuredIds.length) {
    errors.push('Firebase dev, staging and prod must use different project IDs.');
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Firebase environment mapping is valid for ${aliasesToValidate.join(', ')}.`);
