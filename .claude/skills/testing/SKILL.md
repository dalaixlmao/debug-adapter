---
name: testing
description: Testing conventions for this codebase — AAA pattern, F.I.R.S.T principles, and behavior-focused assertions. Use when writing or reviewing any test file.
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
