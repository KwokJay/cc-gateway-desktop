# CC Gateway Standalone CLI

`standalone-cli/` is an additive package for standalone bootstrap, runtime preparation, and direct Claude launch handoff work.
It does not replace `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`.

## Scope

This package currently covers:

- isolated package scaffolding and operator-facing help
- typed credential discovery contracts and follow-on credential discovery work
- standalone workspace bootstrap and local runtime preparation
- direct `claude` handoff through the prepared local gateway environment

The package remains additive and package-local. It does not replace or rewrite the legacy TypeScript gateway, setup scripts, Rust daemon, Rust CLI, or desktop app.

## Usage

- `ccgw-standalone-cli`
- `ccgw-standalone-cli [claude args]`
- `ccgw-standalone-cli discover-credentials`
- `ccgw-standalone-cli prepare-runtime`

Bare invocation and passthrough invocation both:

1. discover local Claude credentials
2. create or reuse the standalone workspace and config
3. ensure the local gateway runtime is healthy
4. launch the locally installed `claude` executable with:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
- `CLAUDE_CODE_ATTRIBUTION_HEADER=false`

If `claude` is missing or cannot be executed, the CLI fails with install and PATH guidance instead of reporting partial success.

## Package-Local Commands

- `npm --prefix standalone-cli run build`
- `npm --prefix standalone-cli run test:launch`
- `npx tsx standalone-cli/tests/cli-help.test.ts`
- `npx tsx standalone-cli/tests/credential-discovery.test.ts`
- `npx tsx standalone-cli/tests/environment-bootstrap.test.ts`
- `npx tsx standalone-cli/tests/proxy-env.test.ts`
- `npx tsx standalone-cli/tests/runtime-preparation.test.ts`
- `npx tsx standalone-cli/tests/claude-launch.test.ts`

The help surface and tests stay package-local so operators can evaluate the new CLI without affecting the legacy TypeScript gateway or the Rust daemon, CLI, and desktop app.
