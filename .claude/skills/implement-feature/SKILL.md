---
name: implement-feature
description: Implement a feature task (T-XX) from a PRD or task breakdown. Use when given a task identifier and need to go from requirements to working, tested TypeScript code — covers layer mapping, design pattern selection, TDD, and completion checklist.
argument-hint: "[task-id]"
---

# Skill: Implement Feature from PRD/Task Breakdown

Use this skill when given a task identifier (T-XX) from a product requirements document or task breakdown. It governs the full lifecycle from reading a task to shipping working, tested TypeScript code.

---

## 1. Task Intake

### Step 1.1 — Read the Task Fully Before Writing Anything

Extract and write down:

| Field | Source |
|-------|--------|
| **Task ID** | T-XX label |
| **Inputs** | Request shape, parameters, env vars, config values |
| **Outputs** | Response shape, side effects, events emitted |
| **Dependencies** | Other tasks that must complete first; existing services/utilities to reuse |
| **Acceptance Criteria** | Every condition that must be true for the task to be done |
| **Error cases** | What can go wrong and what the expected response is |

### Step 1.2 — Map to the Correct Layer

| If the task involves… | The work belongs in… |
|---|---|
| Registering a URL, validating headers/body schema | `src/routes/` |
| Parsing a request, calling a service, building a reply | `src/controllers/` |
| Business logic, data transformation, orchestration | `src/services/` |
| A TypeScript shape for request/response/error | `src/contracts/` |
| Shared numeric or string constants | `src/config/config.ts` |
| Wiring a new dependency | `src/container.ts` |

Never put business logic in a route. Never put HTTP concepts in a service.

### Step 1.3 — Identify the Right Design Pattern

Answer these questions to select a pattern before coding:

1. **Are you creating objects of a family?** → Factory
2. **Are you wrapping an incompatible interface?** → Adapter
3. **Is the algorithm or behavior swappable at runtime?** → Strategy
4. **Are multiple parts of the system reacting to an event?** → Observer
5. **Are you simplifying a complex subsystem behind one entry point?** → Facade
6. **Is an action encapsulated for queuing, undo, or retry?** → Command
7. **Are you building a complex object step-by-step?** → Builder
8. **Must exactly one instance exist globally?** → Singleton

If none apply, no pattern is needed. Do not force one.

---

## 2. Planning Phase

Do this before opening a code file.

### 2.1 — Define the Contract First

Write the TypeScript interface for every input and output in `src/contracts/`. Implementation follows the interface, never the reverse.

```typescript
// src/contracts/session.ts
export interface AttachSessionRequest {
  readonly sessionId: string
  readonly timeout?: number
}

export interface AttachSessionResponse {
  readonly sessionId: string
  readonly status: 'attached' | 'failed'
  readonly error?: string
}
```

### 2.2 — Identify Dependencies

Ask for each dependency:

- **Inject via constructor** if it has I/O, is swappable, or needs to be mocked in tests.
- **Instantiate directly** if it is a pure utility with no side effects.
- **Wire in `src/container.ts`** if it is injected.

### 2.3 — YAGNI Check

For every piece of code you are about to write, ask: *"Does an acceptance criterion in this task require this?"*
If no → do not write it.

### 2.4 — KISS Check

Ask: *"What is the smallest, most direct implementation that passes all acceptance criteria?"*
Write that. Not the general version.

---

## 3. Code Quality Rules

Every file produced must satisfy all of these.

### 3.1 — SOLID in TypeScript

**S — Single Responsibility**

One class, one reason to change. One file, one class (or one set of related pure functions).

```typescript
// ✗ Wrong — controller doing business logic
class DebugController {
  async start(req, reply) {
    const pid = await spawn(req.body.programPath); // business logic here
    reply.send({ sessionId: pid.toString() });
  }
}

// ✓ Correct — controller delegates
class DebugController {
  constructor(private readonly debugService: IDebugService) {}
  async start(req: FastifyRequest<{ Body: StartSessionRequest }>, reply: FastifyReply) {
    const result = await this.debugService.startSession(req.body);
    reply.send(result);
  }
}
```

**O — Open/Closed**

Extend behavior through new implementations of an interface, not by editing existing code.

```typescript
// ✗ Wrong — adding a language requires editing this function
function createDebugger(language: string) {
  if (language === 'node') { /* ... */ }
  else if (language === 'python') { /* ... */ } // new requirement forces edit
}

// ✓ Correct — new language = new class, no edits
interface IDebugAdapter { start(path: string): Promise<void> }
class NodeAdapter implements IDebugAdapter { ... }
class PythonAdapter implements IDebugAdapter { ... }
```

**L — Liskov Substitution**

Any implementation of an interface must honor the full contract: same parameter types, same return types, no extra exceptions.

```typescript
// ✗ Wrong — subtype narrows accepted input
class StrictHealthService implements IHealthService {
  getHealth(version: string): HealthResponse {
    if (!version.includes('.')) throw new Error('invalid'); // original contract does not throw
  }
}
```

**I — Interface Segregation**

A class must not be forced to implement methods it does not use. Split large interfaces.

```typescript
// ✗ Wrong — one fat interface
interface IDebugService {
  start(): Promise<void>
  stop(): Promise<void>
  step(): Promise<void>
  evaluate(expr: string): Promise<unknown>
}

// ✓ Correct — split by cohesion
interface IDebugLifecycle { start(): Promise<void>; stop(): Promise<void> }
interface IDebugEvaluator { evaluate(expr: string): Promise<unknown> }
```

**D — Dependency Inversion**

High-level modules depend on interfaces, not concrete classes.

```typescript
// ✗ Wrong — controller depends on concrete class
import { HealthService } from '../services/health.service';
class HealthController {
  private svc = new HealthService(); // hard dependency
}

// ✓ Correct — depends on interface, injected from container.ts
import { IHealthService } from '../services/health.service';
class HealthController {
  constructor(private readonly svc: IHealthService) {}
}
```

### 3.2 — DRY

If the same logic appears in more than one file, extract it:

- Pure utility → `src/utils/{name}.ts`
- Shared constant or string → `src/config/config.ts`
- Shared type → `src/contracts/`

### 3.3 — Function Rules

- Max 20 lines per function. If it exceeds that, extract a helper.
- One responsibility per function.
- Name functions as `verb + noun`: `buildErrorResponse`, `parseSessionId`, `validateContentType`.

### 3.4 — File Rules

- One class per file, or one cohesive set of pure functions per file.
- File name matches the export: `health.service.ts` exports `HealthService`.

### 3.5 — No Magic Values

```typescript
// ✗ Wrong
reply.status(415).send({ error: 'Unsupported Media Type', code: 'UNSUPPORTED_MEDIA_TYPE' });

// ✓ Correct — constant in src/config/config.ts
export const HTTP_STATUS = { UNSUPPORTED_MEDIA_TYPE: 415 } as const;
export const ERROR_CODES = { UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE' } as const;
```

### 3.6 — Error Handling

- Always use the project error shape: `{ error: string, code: string, requestId?: string }`.
- Error codes are UPPERCASE_SNAKE_CASE.
- Never throw a raw string. Use `new Error(message)` or a typed custom error class.
- For custom errors add a `code` property:

```typescript
export class DebugSessionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'DebugSessionError';
  }
}
```

### 3.7 — Async Rules

- Always `await` every Promise. Never fire-and-forget unless the task explicitly requires it.
- Mark functions `async` only when they contain `await`.
- Propagate errors up; do not silently swallow them with empty `catch {}`.

### 3.8 — Resource Cleanup

Wrap file handles, child processes, timers, and sockets in `try/finally`:

```typescript
const proc = spawn(programPath, args);
try {
  await waitForReady(proc);
  return buildSuccessResponse(proc.pid);
} finally {
  proc.kill();
}
```

### 3.9 — No `console.log`

Use the structured logger (e.g. `fastify.log` or an injected `ILogger`). Remove all `console.log` before committing.

---

## 4. Design Pattern Guide

### Factory

**Use when**: creating objects whose concrete type is determined at runtime from a discrete set of values.
**Do not use when**: there is only one type; a simple `new` call is clearer.

```typescript
interface IDebugAdapter { start(path: string): Promise<string> }

class DebugAdapterFactory {
  static create(language: 'node' | 'python'): IDebugAdapter {
    if (language === 'node') return new NodeAdapter();
    return new PythonAdapter();
  }
}
```

### Adapter

**Use when**: wrapping a third-party or legacy interface to match your internal contract.
**Do not use when**: you control both sides and can change the original.

```typescript
interface IProcessRunner { run(cmd: string, args: string[]): Promise<number> }

class ChildProcessAdapter implements IProcessRunner {
  async run(cmd: string, args: string[]): Promise<number> {
    const proc = spawn(cmd, args);
    return new Promise((res, rej) => {
      proc.on('close', res);
      proc.on('error', rej);
    });
  }
}
```

### Strategy

**Use when**: the algorithm is swappable and callers should not know which one runs.
**Do not use when**: there is only one algorithm and no plans to swap it.

```typescript
interface IStepStrategy { step(session: DebugSession): Promise<void> }
class StepOverStrategy implements IStepStrategy { ... }
class StepIntoStrategy implements IStepStrategy { ... }

class Debugger {
  constructor(private strategy: IStepStrategy) {}
  async step(session: DebugSession) { return this.strategy.step(session); }
  setStrategy(s: IStepStrategy) { this.strategy = s; }
}
```

### Observer

**Use when**: multiple independent parts of the system must react to the same event.
**Do not use when**: there is only one consumer; a direct call is simpler.

```typescript
type SessionEvent = 'started' | 'stopped' | 'crashed';
type Handler = (sessionId: string) => void;

class SessionEventBus {
  private readonly handlers = new Map<SessionEvent, Handler[]>();
  on(event: SessionEvent, handler: Handler) {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...list, handler]);
  }
  emit(event: SessionEvent, sessionId: string) {
    this.handlers.get(event)?.forEach(h => h(sessionId));
  }
}
```

### Facade

**Use when**: a complex subsystem (multiple services, adapters, utilities) must appear as one simple API.
**Do not use when**: the subsystem already has a clean single-entry interface.

```typescript
class DebugSessionFacade {
  constructor(
    private readonly adapter: IDebugAdapter,
    private readonly store: ISessionStore,
    private readonly events: SessionEventBus,
  ) {}

  async startSession(req: StartSessionRequest): Promise<StartSessionResponse> {
    const sessionId = await this.adapter.start(req.programPath);
    await this.store.save(sessionId);
    this.events.emit('started', sessionId);
    return { sessionId, status: 'started' };
  }
}
```

### Command

**Use when**: an action must be encapsulated for queuing, retry, undo, or audit logging.
**Do not use when**: the action is simple and one-shot with no need for deferred execution.

```typescript
interface ICommand { execute(): Promise<void> }

class StartSessionCommand implements ICommand {
  constructor(private readonly adapter: IDebugAdapter, private readonly path: string) {}
  async execute() { await this.adapter.start(this.path); }
}

class CommandQueue {
  private readonly queue: ICommand[] = [];
  enqueue(cmd: ICommand) { this.queue.push(cmd); }
  async flush() { for (const cmd of this.queue) await cmd.execute(); }
}
```

### Singleton

**Use when**: exactly one instance must exist for the lifetime of the process (e.g. a connection pool, config object).
**Do not use when**: the object has no shared mutable state; multiple instances are fine.

```typescript
class ConfigRegistry {
  private static instance: ConfigRegistry;
  private constructor(private readonly values: Record<string, string>) {}

  static getInstance(): ConfigRegistry {
    if (!ConfigRegistry.instance) {
      ConfigRegistry.instance = new ConfigRegistry(process.env as Record<string, string>);
    }
    return ConfigRegistry.instance;
  }
}
```

Note: Prefer the composition root pattern (`src/container.ts`) over Singleton for application-level singletons — it gives the same guarantee without the static coupling.

### Builder

**Use when**: constructing a complex object with many optional fields and the construction logic is non-trivial.
**Do not use when**: the object has two or fewer fields; a plain object literal is clearer.

```typescript
class DebugSessionBuilder {
  private language: 'node' | 'python' = 'node';
  private args: string[] = [];
  private stopOnEntry = false;

  withLanguage(lang: 'node' | 'python') { this.language = lang; return this; }
  withArgs(args: string[]) { this.args = args; return this; }
  withStopOnEntry() { this.stopOnEntry = true; return this; }

  build(): StartSessionRequest {
    return { language: this.language, programPath: '', args: this.args, stopOnEntry: this.stopOnEntry };
  }
}
```

---

## 5. Testing Rules

Write tests **before or alongside** the implementation, never after.

### 5.1 — Test File Naming

| Test type | File pattern |
|---|---|
| Unit (pure function / class) | `tests/{module}.service.test.ts` |
| Integration (HTTP endpoint) | `tests/{module}.test.ts` |
| Contract (response shape) | `tests/contracts/{module}.contract.test.ts` |
| Contract fixture | `tests/contracts/{module}.contract.ts` |

### 5.2 — AAA Structure (every test)

```typescript
it('<expected outcome> when <condition>', () => {
  // Arrange
  const input = buildInput();

  // Act
  const result = sut.doThing(input);

  // Assert
  expect(result).toEqual(expected);
});
```

One behavior per test. One `expect` group per test.

### 5.3 — Unit Tests

- Use `const sut = new ServiceClass()` (or inject mocks via constructor).
- Mock all I/O with `vi.fn()` or `vi.spyOn()`.
- Do not start the HTTP server.

```typescript
describe('DebugService', () => {
  const mockAdapter = { start: vi.fn() } satisfies IDebugAdapter;
  const sut = new DebugService(mockAdapter);

  describe('startSession', () => {
    it('returns started status when adapter resolves', async () => {
      // Arrange
      mockAdapter.start.mockResolvedValue('session-123');

      // Act
      const result = await sut.startSession({ language: 'node', programPath: '/app.js' });

      // Assert
      expect(result).toEqual({ sessionId: 'session-123', status: 'started' });
    });
  });
});
```

### 5.4 — Integration Tests

- Start the app with `await app.ready()` in `beforeAll`.
- Close with `await app.close()` in `afterAll`.
- Use `app.inject()` — do not make real network calls.
- Nest `describe` blocks: outer = route, inner = behavior, innermost = outcome.

```typescript
describe('POST /v1/debug', () => {
  beforeAll(() => app.ready());
  afterAll(() => app.close());

  describe('when body is valid', () => {
    it('returns 200 with a sessionId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/debug',
        headers: { 'content-type': 'application/json' },
        payload: { language: 'node', programPath: '/app.js' },
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ sessionId: expect.any(String) });
    });
  });
});
```

### 5.5 — Contract Tests

Define a fixture and validate every integration test response against it.

```typescript
// tests/contracts/debug.contract.ts
export const startSessionResponseContract = {
  sessionId: expect.any(String),
  status: expect.stringMatching(/^started|failed$/),
};

// tests/contracts/debug.contract.test.ts
it('POST /v1/debug response matches contract', async () => {
  const response = await app.inject({ ... });
  expect(JSON.parse(response.body)).toMatchObject(startSessionResponseContract);
});
```

### 5.6 — Edge Case Checklist

For every endpoint or service method, write tests for:

- [ ] `null` / `undefined` input
- [ ] Empty string or empty array
- [ ] Missing required field
- [ ] Oversized input (beyond limits defined in config)
- [ ] Timeout / slow external resource
- [ ] Concurrent calls (if the method has shared state)
- [ ] Upstream crash / rejection

### 5.7 — Test Naming

Format: `<expected outcome> when <condition>`

```
✓ returns 200 with sessionId when request is valid
✓ returns 415 with UNSUPPORTED_MEDIA_TYPE when content-type is missing
✓ returns started status when adapter resolves successfully
✓ throws DebugSessionError when programPath does not exist
```

---

## 6. Task Completion Checklist

Run through every item before marking a task done. Do not skip.

- [ ] All acceptance criteria from the task are met
- [ ] Unit tests written and passing (`vitest run`)
- [ ] Integration test written and passing
- [ ] Contract test updated if a response shape changed
- [ ] No function exceeds 20 lines
- [ ] No logic is duplicated across files (check for copy-paste)
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] No unused imports
- [ ] No `console.log` remaining
- [ ] Every acquired resource (process, file, timer) has a `try/finally`
- [ ] Error response shape matches `{ error, code, requestId? }` with UPPERCASE_SNAKE_CASE code
- [ ] New dependency wired in `src/container.ts`
- [ ] New constant/string extracted to `src/config/config.ts`
- [ ] New interface added to `src/contracts/`

---

## 7. Workflow Order

Follow these steps in order for every task. Do not skip or reorder.

```
Step 1  Read the task. Write down: inputs, outputs, dependencies, ACs, error cases.
Step 2  Map to the correct layer (route / controller / service / contract / config).
        Identify the design pattern (or confirm none is needed).
Step 3  Write the TypeScript interface in src/contracts/.
        Write the service interface (IXxxService) if introducing a new service.
Step 4  Write the failing test (unit or integration) that directly targets an AC.
Step 5  Write the minimum implementation code to make the test pass.
        Do not add anything not required by the current AC.
Step 6  Refactor for clean code rules:
        - Function length ≤ 20 lines?
        - No magic values?
        - Error handling correct?
        - Resource cleanup in try/finally?
Step 7  Run the completion checklist (Section 6). Fix every unchecked item.
Step 8  Output a summary:
        - What was built (layer + file paths)
        - Which pattern was used (or "no pattern")
        - Which tests were written (filenames + count)
        - Commit message (10–15 words)
```

### Step 8 Summary Template

```
Built: DebugService.attachSession in src/services/debug.service.ts (service layer)
Pattern: Adapter (ChildProcessAdapter wraps Node's spawn)
Tests:
  - tests/debug.service.test.ts — 4 unit tests
  - tests/debug.test.ts — 3 integration tests (added to existing file)
  - tests/contracts/debug.contract.test.ts — contract updated
Commit: feat: implement attachSession with ChildProcessAdapter and unit tests
```
