# Auth Flow Checklist

1. User authenticates.
2. Access sync function executes.
3. Claims are refreshed.
4. UI evaluates role from token claims.
5. Firestore role mismatch triggers safe fallback.
6. Admin actions log actor UID/email and timestamp.