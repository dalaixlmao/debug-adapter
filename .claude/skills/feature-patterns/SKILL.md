---
name: feature-patterns
description: Design principles and patterns to follow when building any feature in this codebase. Use when writing new classes, functions, services, or API layers.
user-invocable: false
---

Before writing any class or function, verify it satisfies these principles and patterns.

## Core Principles

**SOLID**
- **S** — Single Responsibility: one class, one reason to change
- **O** — Open/Closed: open for extension, closed for modification (use interfaces/abstractions)
- **L** — Liskov Substitution: subtypes must be substitutable for their base types
- **I** — Interface Segregation: prefer small, focused interfaces over fat ones
- **D** — Dependency Inversion: depend on abstractions, not concretions; inject dependencies

**KISS** — Solve the problem simply. If the solution needs a comment to explain why it's structured that way, simplify it first.

**YAGNI** — Do not add code for hypothetical future requirements. Only build what the current task needs.

**DRY** — Extract repeated logic once it appears a third time. Prefer a shared abstraction over copy-paste, but don't abstract prematurely.

---

## Creational Patterns

**Factory** — Use when object creation logic is non-trivial or varies by type.
```ts
// Good: creation logic is centralized, callers don't need to know about subtypes
class SessionFactory {
  static create(type: 'node' | 'python'): DebugSession { ... }
}
```

**Builder** — Use for constructing objects with many optional fields (e.g., DAP request payloads, config objects). Avoids telescoping constructors.
```ts
new LaunchRequestBuilder()
  .program('./src/index.ts')
  .stopOnEntry(true)
  .build()
```

**Singleton** — Use only for stateless shared services (e.g., logger, config reader). Never use for stateful objects. Enforce via DI container or module-level export, not `getInstance()` patterns.

---

## Structural Patterns

**Adapter** *(critical)* — Wrap raw DAP protocol responses into your internal vessel/domain format. External protocol shapes must never leak past the adapter boundary.
```ts
class DapResponseAdapter {
  toStackFrame(raw: DebugProtocol.StackFrame): StackFrameVessel { ... }
}
```

**Facade** — Use at the API layer to hide internal complexity (DAP session management, transport negotiation, event routing) behind a clean, minimal surface.
```ts
class DebugAdapterFacade {
  startSession(config: LaunchConfig): Promise<Session> { ... }
  stepOver(sessionId: string): Promise<void> { ... }
}
```

---

## Behavioral Patterns

**Strategy** — Use when behavior varies by context and must be swappable at runtime (e.g., different vessel renderers, output formatters, transport types).
```ts
interface VesselRenderer { render(vessel: Vessel): string }
class JsonRenderer implements VesselRenderer { ... }
class TreeRenderer implements VesselRenderer { ... }
```

**Observer** — Use for streaming debug events (breakpoint hits, output events, step completions). Consumers subscribe; the session emits. Never poll.
```ts
session.on('stopped', (event: StoppedEvent) => { ... })
session.on('output', (event: OutputEvent) => { ... })
```

**Command** — Encapsulate each debug step (stepOver, stepIn, continue, evaluate) as an object. Enables queuing, logging, and undo without coupling callers to session internals.
```ts
interface DebugCommand { execute(): Promise<void> }
class StepOverCommand implements DebugCommand { ... }
class EvaluateCommand implements DebugCommand { ... }
```

---

## Checklist before committing new code

- [ ] Does each class/function have exactly one responsibility?
- [ ] Are dependencies injected (not instantiated inline)?
- [ ] Is this the simplest solution that works? (KISS)
- [ ] Am I building only what this task requires? (YAGNI)
- [ ] Is any logic duplicated from elsewhere? (DRY)
- [ ] Are DAP responses wrapped in an Adapter before entering domain logic?
- [ ] Does the API surface use a Facade to hide session/transport details?
- [ ] Are variable renderer/transport strategies using the Strategy pattern?
- [ ] Are debug lifecycle events using Observer (not polling)?
- [ ] Are step commands encapsulated as Command objects?
