---
name: testing
description: Testing conventions for this codebase — AAA pattern, F.I.R.S.T principles, behavior-focused assertions, and test type selection (unit, integration, contract, edge case). Use when writing or reviewing any test file.
user-invocable: false
---

## Core Principles

### AAA Pattern
Structure every test in three clearly separated blocks:

```ts
it('returns 404 when session not found', async () => {
  // Arrange
  const sessionId = 'nonexistent-id';

  // Act
  const result = await sessionService.getSession(sessionId);

  // Assert
  expect(result).toBeNull();
});
```

### One Behavior Per Test
Each test verifies exactly one observable behavior. If a test needs multiple `expect` calls to verify one logical outcome (e.g., an object's shape), that's acceptable — but a test that checks two different behaviors should be split.

### Test Behavior, Not Implementation
- Test what a function returns or what side effect it causes — not how it does it internally.
- Do not assert on private methods, internal state, or intermediate steps.
- If an implementation changes but the behavior stays the same, no test should break.

```ts
// BAD — tests internal method call
expect(service['_buildQuery']).toHaveBeenCalled();

// GOOD — tests observable outcome
expect(await service.search('foo')).toEqual([...]);
```

### F.I.R.S.T

| Letter | Meaning | In practice |
|--------|---------|-------------|
| **F**ast | Tests run in milliseconds | No real I/O; stub network, DB, file system at boundaries |
| **I**solated | Tests don't share state | Reset mocks in `beforeEach`; no global mutation between tests |
| **R**epeatable | Same result every run | No random values, no wall-clock time, no environment-specific paths |
| **S**elf-validating | Pass or fail without human inspection | No `console.log` to verify; every assertion uses `expect` |
| **T**imely | Written alongside the code | Tests ship in the same PR as the feature |

## Test Structure

```ts
describe('<ClassName or module>', () => {
  // shared setup
  let sut: MyService;

  beforeEach(() => {
    sut = new MyService(/* inject stubs */);
  });

  describe('<method or behavior group>', () => {
    it('<expected outcome> when <condition>', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

- Name tests as `<expected outcome> when <condition>` — readable as a sentence.
- Group related tests under a nested `describe` for the method or scenario.
- Use `sut` (System Under Test) as the variable name for the class being tested.

## What to Test

- **Happy path** — correct inputs produce correct outputs.
- **Edge cases** — empty input, zero, null, boundary values.
- **Error paths** — thrown errors, rejected promises, invalid arguments.
- **Side effects** — was the correct stub/mock called with the right arguments?

## What NOT to Test

- Private/internal methods directly.
- Third-party library internals.
- Trivial getters/setters with no logic.
- Things already covered by type checking.

---

## Test Types

### Unit Tests — Pure Logic, Heavily Mocked

Use when testing a single function, class method, or module with no real I/O.

**Rules:**
- Mock every external dependency (HTTP clients, DB, file system, other services).
- Never start the Fastify app — import and call the function directly.
- Reset all mocks in `beforeEach` to prevent state bleed.

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { parseDebugPayload } from '../src/debug/parseDebugPayload';

describe('parseDebugPayload', () => {
  it('returns parsed result when payload is valid JSON', () => {
    // Arrange
    const raw = JSON.stringify({ code: 'let x = 1', language: 'ts' });

    // Act
    const result = parseDebugPayload(raw);

    // Assert
    expect(result).toEqual({ code: 'let x = 1', language: 'ts' });
  });
});
```

**What to mock:** any `import` that touches the network, filesystem, or another service. Use `vi.mock('../src/someModule')` at the top of the file.

---

### Integration Tests — Real HTTP, Real App

Use when testing a route end-to-end through the Fastify app — middleware, serialization, and handler all exercised together.

**Rules:**
- Use `app.inject()` (Fastify's light injection) instead of a real TCP socket — faster and no port conflicts.
- Start the app once with `beforeAll(() => app.ready())` and close it with `afterAll(() => app.close())`.
- Do NOT mock internal service logic here; the goal is to verify the full request/response pipeline.
- External downstream services (language server, third-party APIs) may still be mocked at the network boundary.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/server';

describe('POST /v1/debug', () => {
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('returns 415 with UNSUPPORTED_MEDIA_TYPE error when content-type is text/plain', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'text/plain' },
      payload: 'plain text',
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(415);
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Unsupported Media Type',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });
});
```

**File location:** `tests/<feature>.test.ts` — same directory as the existing `health.test.ts` and `debug.test.ts`.

---

### Contract Tests — Service Boundary Enforcement

Use when verifying that this service honours the exact request/response shape expected by its callers, or that a downstream service it calls returns what it claims.

**Why they matter here:** this project is a debug-adapter that sits between consumers and downstream services. If either the inbound contract (what callers send) or the outbound contract (what downstream expects) drifts, the adapter silently breaks. Contract tests catch that drift.

**Rules:**
- Assert the exact shape of every request body and response payload — no `toMatchObject` unless a field is explicitly optional in the schema.
- Assert HTTP status codes and error codes (`code` field) as literals, not ranges.
- Keep contracts in a shared `contracts/` or `tests/contracts/` directory so they can be reviewed without reading implementation code.
- When a downstream service schema changes, update the contract test first, then update the implementation.

```ts
// tests/contracts/debug-response.contract.ts
export const debugSuccessContract = {
  status: 'ok',
  result: expect.objectContaining({
    diagnostics: expect.any(Array),
  }),
};

export const debugErrorContract = {
  error: expect.any(String),
  code: expect.stringMatching(/^[A-Z_]+$/),
};
```

```ts
// tests/contracts/debug.contract.test.ts
it('response matches error contract when body is invalid', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/debug', ... });
  expect(JSON.parse(response.payload)).toEqual(debugErrorContract);
});
```

**What to assert:** status code, `Content-Type`, every field in the response body by exact value or documented type — never a loose shape check.

---

### Edge Case Tests — Hostile and Degenerate Inputs

Use when verifying the service does not crash, leak, or return a 500 on unexpected inputs.

**Mandatory edge cases for this codebase:**

| Scenario | What to assert |
|----------|---------------|
| Empty string `""` as `code` field | Graceful error response, not a 500 |
| `null` or missing required fields | 400 or documented error code |
| Extremely long code string (>100 KB) | Timeout or size rejection, not OOM hang |
| Malformed JSON body | 400, not a crash |
| Unexpected extra fields in body | Silently ignored or 400 — document which |
| Wrong HTTP method (GET on a POST route) | 404 or 405 |

```ts
it('returns 400 with INVALID_BODY error when code field is empty string', async () => {
  // Arrange
  const request = {
    method: 'POST' as const,
    url: '/v1/debug',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ code: '', language: 'ts' }),
  };

  // Act
  const response = await app.inject(request);

  // Assert
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.payload).code).toBe('INVALID_BODY');
});
```

**Rule:** every edge case test must assert both the status code AND the error shape — a 400 with the wrong body is still a contract violation.

---

## Choosing the Right Test Type

| Question | Answer → Test Type |
|----------|--------------------|
| Does this function have any I/O or service calls? | No → **Unit**; Yes → see below |
| Am I testing a full HTTP route end-to-end? | Yes → **Integration** |
| Am I verifying the exact shape a caller or downstream relies on? | Yes → **Contract** |
| Am I probing what happens with null/empty/malformed input? | Yes → **Edge Case** |

A single feature typically needs all four: a unit test for the core logic, an integration test for the route, a contract test for the response shape, and edge case tests for hostile inputs.

---

## TypeScript Mocking Patterns

This codebase uses **Vitest** (`vitest`), whose mock API is identical to Jest's — all patterns below work in both. Import from `vitest`, not `jest`.

### Module Mocks — `vi.mock`

Mock an entire module before any imports are resolved. The factory runs at hoist time, so it cannot close over variables declared in the test file (use `vi.hoisted` for that).

```ts
import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/services/languageServer', () => ({
  analyzeCode: vi.fn(),
}));

import { analyzeCode } from '../src/services/languageServer';

describe('DebugService', () => {
  it('calls analyzeCode with trimmed code', async () => {
    // Arrange
    vi.mocked(analyzeCode).mockResolvedValueOnce({ diagnostics: [] });

    // Act
    await debugService.run('  let x = 1  ');

    // Assert
    expect(analyzeCode).toHaveBeenCalledWith('let x = 1');
  });
});
```

**Rules:**
- Always use `vi.mocked(fn)` to get the typed mock — never cast to `jest.Mock` or `any`.
- Prefer `mockResolvedValueOnce` / `mockReturnValueOnce` over `mockResolvedValue` to avoid leaking state across tests.
- Reset call history in `beforeEach` with `vi.clearAllMocks()` (clears calls/instances) or configure `clearMocks: true` in `vitest.config.ts`.

### Spy on a Method Without Replacing the Module

Use `vi.spyOn` to wrap a single method and observe calls while keeping the real implementation (or optionally replacing it).

```ts
import { vi } from 'vitest';
import * as fs from 'fs';

it('reads the correct config path', () => {
  // Arrange
  const spy = vi.spyOn(fs, 'readFileSync').mockReturnValueOnce('{"port":3000}');

  // Act
  loadConfig();

  // Assert
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('config.json'), 'utf8');

  // Cleanup
  spy.mockRestore();
});
```

**Rule:** always call `spy.mockRestore()` after the test (or in `afterEach`) — `spyOn` patches the live module, not a copy.

### Typing Mocked Dependencies in TypeScript

Inject mocks through constructor parameters typed with interfaces, not concrete classes. This lets TypeScript enforce the shape without importing the real implementation.

```ts
// src/services/debugService.ts
export interface ILanguageServer {
  analyzeCode(code: string): Promise<{ diagnostics: Diagnostic[] }>;
}

export class DebugService {
  constructor(private readonly ls: ILanguageServer) {}
}
```

```ts
// tests/debugService.test.ts
import { vi } from 'vitest';
import type { ILanguageServer } from '../src/services/debugService';
import { DebugService } from '../src/services/debugService';

const mockLs: ILanguageServer = {
  analyzeCode: vi.fn(),
};

const sut = new DebugService(mockLs);
```

**Why:** `vi.fn()` on a typed interface property gives you full type-checking on `.mockResolvedValueOnce` return values — the compiler will reject a wrongly-shaped mock response.

### Asserting Call Arguments

Prefer specific matchers over `toHaveBeenCalled()` alone — they catch argument regressions:

```ts
// BAD — only checks the function was called
expect(analyzeCode).toHaveBeenCalled();

// GOOD — checks the exact argument shape
expect(analyzeCode).toHaveBeenCalledWith({
  code: 'let x = 1',
  language: 'typescript',
});

// GOOD — partial match when only some fields matter
expect(analyzeCode).toHaveBeenCalledWith(
  expect.objectContaining({ language: 'typescript' })
);
```

### Mocking Timers

When code uses `setTimeout`, `setInterval`, or `Date.now()`, freeze time to keep tests deterministic:

```ts
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('retries after 1 second on failure', async () => {
  // Arrange
  vi.mocked(analyzeCode).mockRejectedValueOnce(new Error('timeout'));

  // Act
  const promise = debugService.runWithRetry('let x = 1');
  vi.advanceTimersByTime(1000);
  await promise;

  // Assert
  expect(analyzeCode).toHaveBeenCalledTimes(2);
});
```

### Common Anti-Patterns to Avoid

| Anti-pattern | Why it's wrong | Fix |
|-------------|---------------|-----|
| `(fn as any).mockReturnValue(...)` | Bypasses TypeScript — wrong return type goes undetected | Use `vi.mocked(fn).mockReturnValue(...)` |
| `mockResolvedValue` on all tests | Leaks the same value into every test in the suite | Use `mockResolvedValueOnce` per test |
| `vi.mock` inside `it` or `describe` | Vitest hoists `vi.mock` — placing it inside a block has no effect | Always place `vi.mock` at the top level of the file |
| Mocking what you own | Creates a test that doesn't verify real integration | Only mock at service/module boundaries you don't own or that have real I/O |
