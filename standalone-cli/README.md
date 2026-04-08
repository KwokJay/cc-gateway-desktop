# CC Gateway Standalone CLI

`standalone-cli/` is the canonical operator guide for the standalone bootstrap CLI.
This package is additive. It does not replace `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`.

## What This Package Does

The standalone CLI gives operators one package-local flow to:

- discover local Claude credentials
- create or reuse the standalone workspace and config
- prepare or reuse a healthy local gateway runtime
- launch the locally installed `claude` executable with the prepared gateway environment

Use the live command surface only:

- `ccgw-standalone-cli`
- `ccgw-standalone-cli [claude args]`
- `ccgw-standalone-cli discover-credentials`
- `ccgw-standalone-cli prepare-runtime`

Bare invocation and `ccgw-standalone-cli [claude args]` follow the same path: discover credentials, prepare runtime, then hand off to `claude` with unchanged argv.

## First Run

On first run, start with either the full handoff flow or the explicit subcommands:

```bash
ccgw-standalone-cli
ccgw-standalone-cli discover-credentials
ccgw-standalone-cli prepare-runtime
```

The first run will:

1. Discover local Claude credentials from the supported sources.
2. Create the standalone workspace under `~/.ccgw/standalone-cli/`.
3. Write the operator-visible workspace artifacts:
   - `~/.ccgw/standalone-cli/manifest.json`
   - `~/.ccgw/standalone-cli/config.yaml`
   - `~/.ccgw/standalone-cli/runtime.json`
4. Wait for a healthy local gateway runtime.
5. Launch the locally installed `claude` executable.

The launched Claude process receives the prepared gateway environment, including:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
- `CLAUDE_CODE_ATTRIBUTION_HEADER=false`

## Repeat Run Behavior

Repeat run behavior is intentionally stable and idempotent.

- `~/.ccgw/standalone-cli/manifest.json` remains the durable source of truth for the standalone workspace.
- `~/.ccgw/standalone-cli/config.yaml` is re-rendered from current state instead of creating duplicate bootstrap artifacts.
- `~/.ccgw/standalone-cli/runtime.json` tracks the prepared runtime so healthy matching runtime state can be reused safely.

On a repeat run or rerun, the CLI should reuse the standalone workspace, reuse stable local client identity, and refresh OAuth values when newer credentials are discovered. Operators should expect the same workspace paths on first run and repeat run rather than a second bootstrap location.

## Recovery

### Missing Credentials

If credential discovery fails because credentials are missing or not available:

1. Run `claude`
2. Complete browser login
3. Retry `ccgw-standalone-cli discover-credentials`
4. Retry `ccgw-standalone-cli` or `ccgw-standalone-cli [claude args]`

If stored credentials are stale or malformed, re-run `claude`, complete browser login, and then retry the standalone CLI flow.

### Missing `claude`

If `claude` is missing or cannot be executed, use the same recovery guidance emitted by the CLI:

```text
Install Claude Code if needed: npm install -g @anthropic-ai/claude-code
Open a new shell and confirm claude --help works from PATH
Retry ccgw-standalone-cli [claude args]
```

## Validation

The primary reviewer command for the aggregate standalone validation surface is:

```bash
npm --prefix standalone-cli test
```

Useful focused commands remain available:

```bash
npm --prefix standalone-cli run build
npx tsx standalone-cli/tests/cli-help.test.ts
npx tsx standalone-cli/tests/credential-discovery.test.ts
npx tsx standalone-cli/tests/environment-bootstrap.test.ts
npx tsx standalone-cli/tests/proxy-env.test.ts
npx tsx standalone-cli/tests/runtime-preparation.test.ts
npx tsx standalone-cli/tests/claude-launch.test.ts
npx tsx standalone-cli/tests/operator-guidance.test.ts
```

The aggregate package-local validation surface from Wave 1 remains the main proof path. This guide exists to keep operator guidance aligned with that checked-in validation surface instead of creating a second handbook.
