# Risk Patterns

## Critical

- Role escalation via client-writable role/company fields.
- Sensitive lookup collections readable by broad audience.
- Worker can update operational status fields.

## High

- Public create without payload shape constraints.
- Missing ownership checks on subcollections.

## Medium

- Overly broad read permissions for internal metrics.
- Inconsistent status enum checks.