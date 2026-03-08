# Test Matrix

1. Unauthenticated user cannot read private user docs.
2. Worker can read own profile and cannot read other worker private docs.
3. Worker cannot update immutable identity fields.
4. Company admin can manage only own company subtree.
5. Superadmin can execute admin-only actions.
6. Public endpoints reject malformed payloads.