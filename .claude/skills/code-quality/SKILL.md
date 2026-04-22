---
name: code-quality
description: Clean code rules, error handling conventions, and layered architecture constraints for this codebase. Use when writing or reviewing any function, service, or controller.
user-invocable: false
---

Apply these rules whenever writing or modifying code in this project.

## Clean Code Rules

**Naming**
- Variables and functions: describe what they hold/do, not how they do it (`getUserById`, not `fetchData`)
- Booleans: prefix with `is`, `has`, `can`, `should` (`isConnected`, `hasBreakpoint`)
- Avoid abbreviations unless universally understood (`req`, `res`, `dap` are fine; `mgr`, `hlpr` are not)
- Classes: noun or noun phrase (`DebugSession`, `BreakpointRegistry`)
- Functions: verb or verb phrase (`startSession`, `resolveStackFrame`)

**Function size and shape**
- One function does one thing. If you need "and" to describe it, split it.
- Target ≤ 20 lines per function. Extract helpers rather than scrolling.
- Max 3 parameters. If more are needed, pass a typed options object.
- No boolean flags as parameters — they signal the function does two things.

**Single Responsibility**
- A module file owns one concept (e.g., session lifecycle, not session + transport + formatting).
- If adding a feature requires editing an unrelated method, the class has too many responsibilities.

---

## Error Handling Conventions

**Typed errors** — Define domain error classes; never throw raw strings or untyped `Error`.
```ts
class DapConnectionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'DapConnectionError'
  }
}
```

**Propagation rules**
- **Repository layer**: catches infrastructure errors (DB, network, DAP transport), wraps them into domain errors, rethrows.
- **Service layer**: catches domain errors it can handle (retry, fallback); lets unrecoverable ones propagate.
- **Controller layer**: catches all errors, maps to HTTP status codes or structured API responses. Never leaks stack traces to clients.

**No silent swallowing** — Never `catch (e) {}` or `catch (e) { console.log(e) }` without either handling or rethrowing. At minimum, rethrow with context:
```ts
catch (e) {
  throw new DapConnectionError('TIMEOUT', `Failed to attach to process ${pid}: ${e.message}`)
}
```

**Async boundaries** — All `async` functions must either return a rejected promise or throw; never mix fire-and-forget with error-sensitive flows without explicit `.catch()`.

**Result type for expected failures** — For operations where failure is a normal outcome (e.g., evaluate expression that may be invalid), return a result object instead of throwing:
```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string }
```

---

## Layered Architecture

Strict call direction: **Controller → Service → Repository**. No layer may skip or reverse this order.

```
src/
├── controllers/   # HTTP handlers — parse input, call service, return response
├── services/      # Business logic — orchestrate, validate, apply rules
└── repositories/  # Data access — DAP protocol calls, DB queries, external I/O
```

**Controller** (`controllers/`)
- Parses and validates request input (path params, body, query)
- Calls one or more service methods
- Maps service results to HTTP responses
- No business logic, no direct repository calls, no DAP protocol details

**Service** (`services/`)
- Owns all business rules and orchestration
- May call multiple repositories or other services
- No HTTP concepts (`req`, `res`, status codes)
- No raw DAP protocol calls — uses repository abstractions

**Repository** (`repositories/`)
- Single source of truth for data access and external protocol communication
- Wraps DAP adapter calls, database queries, file I/O
- Returns domain objects, not raw protocol payloads (use Adapter pattern here)
- No business logic, no HTTP concepts

**Cross-cutting concerns** (logging, auth, validation) live in `middleware/` or `utils/` — never inline across layers.

---

## Checklist before committing

- [ ] Do all names describe intent without needing a comment?
- [ ] Are functions ≤ 20 lines and single-purpose?
- [ ] Are errors typed, wrapped with context, and propagated correctly per layer?
- [ ] Does no controller call a repository directly?
- [ ] Does no service reference `req`/`res` or HTTP status codes?
- [ ] Does no repository contain business logic?
- [ ] Are cross-cutting concerns in middleware/utils, not scattered inline?
