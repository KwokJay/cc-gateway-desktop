# CC Gateway Standalone CLI

`standalone-cli/` is an additive package for Phase 6 scaffold and credential discovery work.
It does not replace `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`.

## Scope

This package currently covers only:

- isolated package scaffolding
- operator-facing help and documentation
- typed credential discovery contracts and follow-on credential discovery work

This package does not yet cover proxy startup, config generation, runtime preparation, or `claude` launch behavior.
Those behaviors are reserved for later phases in the roadmap.

## Package-Local Commands

- `npm --prefix standalone-cli run build`
- `npx tsx standalone-cli/tests/cli-help.test.ts`
- `npx tsx standalone-cli/tests/credential-discovery.test.ts`

The help surface and tests are package-local so operators can evaluate the new CLI without affecting the legacy TypeScript gateway or the Rust daemon, CLI, and desktop app.
