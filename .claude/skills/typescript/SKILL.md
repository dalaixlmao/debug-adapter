---
name: typescript
description: TypeScript conventions for this codebase — strict mode rules, interfaces vs types, and dependency injection patterns. Use when writing any TypeScript file.
user-invocable: false
---

Apply these conventions in every TypeScript file in this project.

## Strict Mode

`tsconfig.json` must have `"strict": true`. This enables and enforces:
- `noImplicitAny` — every variable and parameter must have an explicit or inferable type; never let `any` slip in silently
- `strictNullChecks` — `null` and `undefined` are not assignable to other types; handle them explicitly
- `strictFunctionTypes` — function parameter types are checked contravariantly
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`, not `T`

**Never use `any`** — if a type is genuinely unknown, use `unknown` and narrow it before use. If a third-party type is missing, write a local declaration file instead of casting to `any`.

```ts
// Bad
function parse(input: any): any { ... }

// Good
function parse(input: unknown): ParsedResult {
  if (typeof input !== 'object' || input === null) throw new ParseError('invalid input')
  ...
}
```

**Avoid type assertions (`as`)** except at verified boundaries (e.g., after a runtime type guard). Never use non-null assertion (`!`) — handle the nullable case explicitly.

---

## Interfaces over Types for Contracts

Use `interface` for any shape that represents a contract: service APIs, repository signatures, domain objects, constructor parameter bags, event payloads.

Use `type` only for:
- Union or intersection types (`type Status = 'running' | 'stopped'`)
- Utility type aliases (`type Nullable<T> = T | null`)
- Mapped or conditional types

```ts
// Contract — use interface
interface DebugSessionRepository {
  findById(id: string): Promise<DebugSession | null>
  save(session: DebugSession): Promise<void>
}

// Union — use type
type StepAction = 'stepOver' | 'stepIn' | 'stepOut' | 'continue'
```

Prefer `readonly` on interface properties that should not be mutated after construction:
```ts
interface BreakpointVessel {
  readonly id: string
  readonly line: number
  verified: boolean  // mutable: updated by DAP response
}
```

---

## Dependency Injection

Depend on interfaces, not concrete classes. Inject dependencies through the constructor — never instantiate collaborators inline.

```ts
// Bad — hard-coded dependency, untestable
class DebugService {
  private repo = new DebugSessionRepository()
}

// Good — depends on abstraction, injectable
class DebugService {
  constructor(private readonly repo: IDebugSessionRepository) {}
}
```

**Constructor injection is the default.** Only use property or method injection when a framework requires it.

Register and resolve dependencies in a single composition root (e.g., `src/container.ts`). Nothing outside the composition root should call `new` on a service or repository.

```ts
// src/container.ts
const sessionRepo = new PrismaSessionRepository(db)
const dapAdapter  = new NodeDapAdapter(config)
export const debugService = new DebugService(sessionRepo, dapAdapter)
```

**Inject interfaces, export instances** — callers import the resolved instance from the container, not the class itself. This keeps the rest of the codebase free of instantiation logic.

---

## Additional Conventions

- Prefer `const` over `let`; never use `var`
- Use `enum` only for closed, stable value sets; prefer union string types for open or growing sets
- Avoid namespace/module syntax — use ES module `import`/`export`
- Generic type parameters: single uppercase letter for simple cases (`T`, `K`, `V`); descriptive name for non-obvious cases (`TEntity`, `TResponse`)
- Mark all async functions with `async` explicitly; avoid implicit promise returns from non-async functions

---

## Checklist before committing

- [ ] No `any` — replaced with `unknown` + narrowing or a proper type?
- [ ] No `as` casts outside verified type-guard boundaries?
- [ ] No `!` non-null assertions — nullable cases handled explicitly?
- [ ] Contracts (services, repos, events) defined as `interface`, not `type`?
- [ ] All dependencies injected via constructor, not instantiated inline?
- [ ] Composition root (`container.ts`) is the only place calling `new` on services?
- [ ] `strict: true` still passes after your changes (`tsc --noEmit`)?
