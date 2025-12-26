# solver chat
* https://chatgpt.com/share/694efdc8-0470-800c-8913-964c119d7f79


----------------------------------------

8. Recommended convention (what you should use)

Since you’re working with geometry, tilings, and solvers:

✔ Use this:

Place A at bottom-left or leftmost

Order vertices counterclockwise

Keep polygon “upright” if possible

Use consistent orientation everywhere

Document orientation once, then rely on it

Example:

D ---- C
|      |
A ---- B


Vertices: A → B → C → D




-----------------------------


https://chatgpt.com/share/694efdae-2768-800c-acd9-fbc23d408c18


please characterize the kind of codebase that are easiest to maintain and add features to for 
* human developers
* ai agent developers


Here’s the pattern: the easiest codebases to maintain and extend are the ones that make change cheap by making intent obvious, blast radius small, and validation fast. Humans and AI agents overlap a lot—but they diverge on what “obvious” means.

For human developers
What’s easiest

Clear architecture with few “magic” pathways

A small number of well-known flows (request → handler → domain/service → persistence).

High cohesion, low coupling

Things that change together live together; changing one feature doesn’t require touching 12 unrelated modules.

Stable boundaries

Modules/packages expose a small API; internals can churn without breaking everything.

Boring, consistent patterns

One way to do routing, one way to do DB access, one way to do async jobs, etc.

Fast feedback

Quick unit tests, cheap integration tests, good local dev loop, good logs.

Code smells that make humans slow

“Clever” abstractions (too much generics/meta-programming) where the real behavior is hidden.

Global state, hidden side effects, implicit initialization order.

Huge files, huge classes, or “god modules”.

Inconsistent conventions across folders/packages.

For AI agent developers

AI agents are especially good when the codebase is:

Searchable, predictable, and test-verifiable,

with strong local reasoning (the agent can understand a change by reading a small slice).

What’s easiest

Explicit contracts everywhere

Types, schemas, interfaces, DTOs, OpenAPI, SQL migrations, etc. Anything that spells out shape + invariants.

Low-context changes

Most features can be implemented by editing 3–10 files in one area, not “touch everything”.

Mechanical patterns

Repetitive structure: “feature folders” or “vertical slices” with templates. Agents excel at consistent repetition.

Great tooling surface

Lint + format + typecheck + test commands that are stable and fast.

CI that matches local.

Self-checking system

A change either passes tests/typecheck or it doesn’t. Agents need tight guardrails.

Code smells that make agents fail

Implicit behavior (reflection-heavy DI, runtime monkeypatching, magic string registries).

Too many ways to do the same thing (agents pick the “wrong” pattern and drift your style).

Sparse tests (agents can make changes that “look right” but break behavior).

Non-local invariants (a rule enforced only in someone’s head or in a wiki).

Where both agree (the “golden” codebase)

If you want both humans and AI to move fast, optimize for:

Small, explicit module APIs

“Here’s what you can call; everything else is private.”

One obvious way

Conventions > choice.

Vertical feature ownership

Feature code sits together (UI + domain + persistence adapters), with shared libs only for truly shared concerns.

Deterministic build + test

typecheck, lint, test, e2e are predictable and fast.

Strong types + runtime validation at boundaries

Types for dev speed; runtime checks for safety at integration points.

Docs that live next to code

Short READMEs per module, plus “how to add a feature” playbook.

Practical “AI-friendly” upgrades that also help humans

Add a /docs/architecture.md with: boundaries, main flows, “how to add X”.

Add “golden commands” in root package.json: lint, typecheck, test, test:watch, e2e.

Enforce formatting + import rules + file naming conventions.

Prefer explicit dependency injection via constructors/params over magic containers (or keep DI container usage very uniform).

Add contract tests at boundaries (API, queue messages, DB schema).

If you tell me your stack (monorepo? TS? services? DB? frontend?), I can map this into a concrete folder/package layout + rules that make “add feature” almost template-driven for both humans and agents.
