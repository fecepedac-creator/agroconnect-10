# Role Contract

## Allowed roles

- worker
- company_admin
- company_hr
- superadmin

## Constraints

- Client cannot self-assign privileged roles.
- Superadmin grant/revoke is server-only.
- Claims update must be followed by token refresh in critical flows.

## Precedence

- Privileged actions require valid claim.
- Firestore role used as secondary context, not sole source for elevation.