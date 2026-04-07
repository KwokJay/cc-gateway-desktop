# Milestone Research Summary

## Stack Additions

- No new platform stack is required. The milestone fits the existing Node.js 22 + TypeScript toolchain.
- The new CLI should reuse Node stdlib plus the existing `yaml` dependency and preserve proxy-awareness through current environment conventions.

## Feature Table Stakes

- Inventory the TypeScript backend capability surface before implementation.
- Detect Claude credentials locally, generate or reuse bootstrap artifacts, and make the flow repeatable.
- Launch the installed `claude` executable with the correct gateway-oriented environment and transparent argument pass-through.
- Keep all existing TypeScript and Rust program paths unchanged.

## Watch Out For

- Do not confuse "bootstrap CLI" with "full gateway rewrite." The milestone is narrower.
- Runtime readiness must happen before `claude` launch, not in parallel with it.
- Credential discovery and repeat-run idempotency are the highest-risk operator experience gaps.
