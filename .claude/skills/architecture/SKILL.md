---
name: architecture
description: Microservice communication contracts and schema-first design rules for this codebase. Use when designing or modifying service boundaries, request/response shapes, or any cross-service interaction.
user-invocable: false
---

Apply these conventions whenever adding or changing service communication or designing a new feature.

## Schema-First Design

**Define the interface before writing any implementation.**

1. Write the TypeScript interface (or JSON Schema / OpenAPI spec) for the request and response shapes
2. Get the contract agreed on (review, comment, or explicit sign-off)
3. Only then implement the service, controller, and repository

This order is non-negotiable. Implementation details may change freely; the contract must be stable before code is written against it.

```ts
// Step 1 — define contract in src/contracts/debug-session.ts
interface StartSessionRequest {
  readonly language: 'node' | 'python'
  readonly programPath: string
  readonly args?: string[]
  readonly stopOnEntry?: boolean
}

interface StartSessionResponse {
  readonly sessionId: string
  readonly status: 'started' | 'failed'
  readonly error?: string
}

// Step 2 — implement service against these shapes, not the other way around
```

Contract files live in `src/contracts/`. They must contain only interfaces, types, and enums — no implementation code, no imports from service layers.

---

## Microservice Communication Contracts

### Request / Response Schema

Every cross-service request and response must be:
- **Typed** — defined as an interface in `src/contracts/`
- **Versioned** — include a `version` field or embed the version in the route (`/v1/`)
- **Explicit about optionality** — required fields are non-optional; optional fields carry `?` and a documented default

```ts
// src/contracts/evaluate.ts
interface EvaluateRequest {
  readonly sessionId: string
  readonly expression: string
  readonly frameId?: number      // defaults to top frame if omitted
  readonly context?: 'watch' | 'repl' | 'hover'  // defaults to 'repl'
}

interface EvaluateResponse {
  readonly result: string
  readonly type?: string
  readonly variablesReference: number  // 0 = leaf value, >0 = expandable
}
```

### Error Response Shape

All services return errors in a single shared envelope — no ad-hoc error objects:

```ts
// src/contracts/errors.ts
interface ErrorResponse {
  readonly error: string        // human-readable message
  readonly code: string         // machine-readable constant, e.g. 'SESSION_NOT_FOUND'
  readonly requestId?: string   // for tracing
}
```

HTTP status codes map to error categories:
| Status | Category |
|--------|----------|
| 400 | Caller error — malformed request or invalid input |
| 404 | Resource not found |
| 409 | Conflict — e.g. session already exists |
| 422 | Semantically invalid — request is well-formed but violates a rule |
| 500 | Internal error — never expose stack traces |
| 503 | Dependency unavailable — DAP adapter not reachable |

### Service-to-Service Calls

- Services communicate through their public interfaces (`IDebugService`, `IBreakpointService`), not by importing each other's concrete classes
- Shared contracts live in `src/contracts/` — both caller and callee import from there; neither owns the contract
- No service reaches into another service's repository layer directly
- All cross-service calls are async; never block on synchronous shared state

### Versioning

- Route version prefix is required for all public endpoints: `/v1/sessions`, `/v2/evaluate`
- Breaking changes (removed fields, changed types, renamed routes) require a new version
- Non-breaking additions (new optional fields, new non-breaking status codes) may be added to the existing version with a changelog note in the contract file

---

## Contract File Conventions

```
src/
└── contracts/
    ├── index.ts          # re-exports all contracts
    ├── errors.ts         # shared ErrorResponse
    ├── debug-session.ts  # StartSession, StopSession, ListSessions
    ├── breakpoint.ts     # SetBreakpoint, RemoveBreakpoint
    └── evaluate.ts       # Evaluate, Variables
```

Rules for contract files:
- `readonly` on all fields — contracts are data, not mutable state
- No `any`, no `unknown` without a comment explaining why
- Enums for closed value sets; union string types for open/growing sets
- Deprecate fields with a JSDoc `@deprecated` tag before removing them across a version boundary

---

## Checklist before committing

- [ ] Was the contract interface written and reviewed before implementation started?
- [ ] Are all request/response shapes defined in `src/contracts/`?
- [ ] Does every error response use the shared `ErrorResponse` envelope?
- [ ] Are HTTP status codes mapped correctly to the error category table above?
- [ ] Are breaking changes gated behind a new API version?
- [ ] Do services communicate through interfaces, not concrete classes or direct repo calls?
- [ ] Are all contract fields `readonly`?
