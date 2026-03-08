# Logging Contract

Required fields:
- function
- severity
- action
- actorUid (if any)
- outcome
- errorCode (if failure)

Rules:
- Do not include secrets.
- Keep messages concise and queryable.