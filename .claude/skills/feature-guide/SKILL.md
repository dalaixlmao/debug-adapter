---
name: feature-guide
description: Master guide for implementing any new feature end-to-end. Use this skill first whenever told to add, build, or implement a feature. It orchestrates all other skills in the correct order and tells you which skill to consult at each phase.
argument-hint: "[feature-description]"
---

# Feature Implementation Master Guide

Read this skill fully before writing a single line of code. It tells you what to do, in which order, and which skill to consult at each phase. Every phase is mandatory.

---

## Phase 0 — Skill Selection (read before every feature)

Use this table to determine which skills are active for the current feature:

| What the feature involves | Skills to load |
|---|---|
| Any TypeScript file | `typescript` |
| New class, function, service, or API layer | `feature-patterns` |
| New or modified route / controller / service / repo | `code-quality` |
| Cross-service boundaries, request/response shapes | `architecture` |
| Writing or modifying tests | `testing` |
| A task identifier (T-XX) from a PRD | `implement-feature` |
| Designing new skills or reusable Claude Code workflows | `skill-maker` |

**Rule:** for most features, all six skills apply. Load them all.

---

## Phase 1 — Task Intake (consult: `implement-feature` §1)

Before touching any file:

1. Write down the feature in one sentence: what it does, what it takes in, what it returns.
2. List all acceptance criteria — the exact conditions that must be true for the feature to be done.
3. List every error case and its expected response (status code + error code).
4. Identify which layers are touched: route / controller / service / repository / contract / config.
5. Identify existing code to reuse — search the codebase before writing anything new.

**Stop here if any AC is ambiguous. Resolve ambiguity before proceeding.**

---

## Phase 2 — Architecture & Contract (consult: `architecture`)

1. Write the TypeScript interface for every input and output in `src/contracts/` **before** any implementation.
2. Use the `ErrorResponse` envelope for all errors: `{ error: string, code: string, requestId?: string }`.
3. Assign the correct HTTP status code using the error category table:

   | Status | Use for |
   |--------|---------|
   | 400 | Malformed request or invalid input |
   | 404 | Resource not found |
   | 409 | Conflict |
   | 422 | Well-formed but rule-violating |
   | 500 | Internal error — never expose stack traces |
   | 503 | Dependency unavailable |

4. Route version prefix is required: `/v1/`, `/v2/`.
5. All contract fields must be `readonly`. No `any`. No implementation code in `src/contracts/`.

---

## Phase 3 — Design Pattern Selection (consult: `feature-patterns`)

Answer each question and select a pattern **before writing implementation code**:

| Question | Pattern |
|---|---|
| Creating objects from a runtime-determined type? | Factory |
| Wrapping an incompatible third-party interface? | Adapter |
| Algorithm is swappable at runtime? | Strategy |
| Multiple parts of the system react to an event? | Observer |
| Hiding complex subsystem behind one entry point? | Facade |
| Action needs queuing, retry, or undo? | Command |
| Building a complex object with many optional fields? | Builder |
| Exactly one instance must exist globally? | Singleton |

If no pattern applies, use none. Do not force a pattern.

**SOLID checklist before coding:**
- S: one class, one reason to change
- O: extend via new implementations, not by editing existing code
- L: subtypes honour the full contract of their base
- I: small focused interfaces, not fat ones
- D: depend on abstractions, inject via constructor

---

## Phase 4 — Layer Mapping (consult: `code-quality`, `implement-feature` §1.2)

Map every piece of work to exactly one layer. Never mix concerns.

| Work belongs in… | Layer |
|---|---|
| URL registration, header/body schema validation | `src/routes/` |
| Request parsing, service calls, HTTP response building | `src/controllers/` |
| Business logic, orchestration, transformation | `src/services/` |
| DAP protocol calls, DB queries, external I/O | `src/repositories/` |
| Request/response/error TypeScript shapes | `src/contracts/` |
| Shared constants, error codes, HTTP status codes | `src/config/config.ts` |
| New dependency wiring | `src/container.ts` |

**Hard rules:**
- Controller never calls a repository directly.
- Service never references `req`, `res`, or HTTP status codes.
- Repository contains no business logic.
- Cross-cutting concerns (logging, auth, validation) go in `middleware/` or `utils/`.

---

## Phase 5 — Code Quality Rules (consult: `code-quality`, `typescript`)

Apply to every file produced.

**TypeScript**
- `strict: true` — no `any`, no `!` non-null assertions, no `as` casts outside type-guard boundaries.
- `interface` for contracts and service signatures; `type` for unions and utility aliases.
- `const` over `let`; never `var`.
- All dependencies injected via constructor; `src/container.ts` is the only place that calls `new` on a service.

**Functions**
- Max 20 lines. If it exceeds that, extract a helper.
- One responsibility. If you need "and" to describe it, split it.
- Max 3 parameters; beyond that, use a typed options object.
- Name as `verb + noun`: `buildErrorResponse`, `parseSessionId`.

**No magic values** — extract every literal string, number, and error code to `src/config/config.ts`.

**Error handling**
- Always use typed custom errors with a `code` property.
- Repository: catch infrastructure errors, wrap into domain errors, rethrow.
- Service: catch domain errors it can handle; let unrecoverable ones propagate.
- Controller: catch all errors, map to HTTP responses. Never leak stack traces.
- Never `catch (e) {}` — at minimum rethrow with context.

**Resource cleanup** — wrap file handles, child processes, timers, and sockets in `try/finally`.

**No `console.log`** — use the structured logger (`fastify.log` or injected `ILogger`).

---

## Phase 6 — Test-Driven Implementation (consult: `testing`, `implement-feature` §5)

Write the failing test first, then write the minimum code to make it pass.

### Test types required for every feature

| Type | When to write | File location |
|---|---|---|
| Unit | Core logic with mocked I/O | `tests/{module}.service.test.ts` |
| Integration | Full HTTP route end-to-end | `tests/{module}.test.ts` |
| Contract | Exact request/response shape | `tests/contracts/{module}.contract.test.ts` |
| Edge case | Null, empty, oversized, malformed inputs | Inline in integration or unit file |

**Every test must:**
- Use AAA structure (Arrange / Act / Assert).
- Be named `<expected outcome> when <condition>`.
- Test one behavior per `it` block.
- Use `vi.mocked(fn)` — never cast to `any`.
- Use `mockResolvedValueOnce` — not `mockResolvedValue` — to avoid state bleed.

**Mandatory edge cases:**

| Scenario | Assert |
|---|---|
| Empty string as required field | Graceful 400, not 500 |
| `null` or missing required field | 400 or documented error code |
| Oversized input (>64 KB for code) | Rejection, not OOM hang |
| Malformed JSON body | 400, not crash |
| Wrong HTTP method | 404 or 405 |

**Integration test skeleton:**
```ts
describe('POST /v1/<route>', () => {
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });

  describe('when body is valid', () => {
    it('returns 200 with expected shape', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/<route>',
        headers: { 'content-type': 'application/json' },
        payload: { /* valid body */ },
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ /* contract */ });
    });
  });
});
```

---

## Phase 7 — Performance & Optimization

Apply these checks after the implementation is functionally complete and all tests pass.

**Async**
- `await` every Promise. No fire-and-forget unless explicitly required by the task.
- Mark functions `async` only when they contain `await`.
- Never block the event loop with synchronous I/O in a hot path.

**Resource management**
- Close connections, streams, and child processes in `finally` blocks.
- Do not leak listeners — remove `on(event, handler)` subscriptions when the session ends.

**Avoid redundant computation**
- Do not call the same pure function more than once with the same arguments in a single request lifecycle — store the result.
- Do not fetch the same resource twice in the same handler.

**Payload size**
- Validate and reject oversized inputs at the route boundary before any processing.
- Never load a large payload into memory if it can be streamed.

**No premature optimisation** — only apply the above where a real hot path or resource concern exists in the current task.

---

## Phase 8 — Completion Checklist

Run through every item. Do not mark the feature done until all boxes are checked.

- [ ] All acceptance criteria from the task are met
- [ ] Contract interface written in `src/contracts/` before implementation
- [ ] Unit tests written and passing (`vitest run`)
- [ ] Integration test written and passing
- [ ] Contract test updated if a response shape changed
- [ ] Edge case tests cover: null, empty, oversized, malformed, wrong method
- [ ] No function exceeds 20 lines
- [ ] No logic duplicated across files
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] No unused imports
- [ ] No `console.log` remaining
- [ ] Every acquired resource has a `try/finally`
- [ ] Error response shape matches `{ error, code, requestId? }` with `UPPERCASE_SNAKE_CASE` code
- [ ] All HTTP status codes are correct per the error category table
- [ ] New dependency wired in `src/container.ts`
- [ ] New constants extracted to `src/config/config.ts`
- [ ] `strict: true` still passes

---

## Phase 9 — Output Summary & Commit Message

After the checklist passes, output this summary:

```
Built:   <ClassName.method> in <file path> (<layer>)
Pattern: <Pattern used, or "no pattern">
Tests:
  - <test file> — <N> unit tests
  - <test file> — <N> integration tests
  - <test file> — contract updated / added
Commit:  <10–15 word commit message>
```

**Commit message rules:**
- 10–15 words, imperative mood, no trailing period.
- Format: `<type>: <what was built and why in one line>`
- Types: `feat`, `fix`, `refactor`, `test`, `chore`
- Example: `feat: add session timeout validation with typed error and edge case tests`

**Always output the commit message at the end of every feature implementation.**

---

## When to Create a New Skill

Create a new skill in `.claude/skills/` when **all three** conditions are true:

1. The workflow or convention will be needed across multiple features or sessions (not just this task).
2. The knowledge cannot be derived from reading the current code or git history.
3. The skill is shorter than 500 lines and focused on one concern.

**Good candidates:** a new language adapter convention, a repeatable deployment checklist, a project-specific API naming rule, a reusable testing pattern for a new service type.

**Bad candidates:** a one-off fix recipe, a summary of recent changes, an ephemeral task plan, anything already in `CLAUDE.md`.

**When creating a skill, consult `skill-maker`.** Choose the correct frontmatter:
- Side-effect workflows (deploy, commit, send) → `disable-model-invocation: true`
- Background knowledge not user-triggered → `user-invocable: false`
- Needs git/bash without per-use prompts → `allowed-tools: Bash(git *)`
- Heavy research → `context: fork` + `agent: Explore`
- Specific file types only → `paths: src/**/*.ts`

Place the new skill at `.claude/skills/<kebab-case-name>/SKILL.md` and update `MEMORY.md` if it introduces a persistent project convention.
