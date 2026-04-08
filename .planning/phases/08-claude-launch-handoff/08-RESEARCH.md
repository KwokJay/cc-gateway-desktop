# Phase 8: Claude Launch Handoff - Research

**Researched:** 2026-04-08 [VERIFIED: local date, repo files]  
**Domain:** standalone CLI launch handoff, executable resolution, env injection, failure handling [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md, standalone-cli/src/cli.ts, scripts/add-client.sh]  
**Confidence:** HIGH for current repo state and Node launch primitives; MEDIUM for the recommended command-shape choice because no Phase 8 context file locks the UX yet. [VERIFIED: repo files, local command, Node docs] [ASSUMED]

<user_constraints>
## User Constraints

No `08-CONTEXT.md` exists, so the constraints below are derived from the explicit user request, milestone docs, and the standing isolation boundary. [VERIFIED: init phase-op output, .planning/ROADMAP.md, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md]

### Locked Decisions

- All implementation must stay inside `standalone-cli/` and must not modify `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`. [VERIFIED: user request, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md]
- Preserve the legacy launcher environment contract: `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, and `CLAUDE_CODE_ATTRIBUTION_HEADER=false`. [VERIFIED: user request, scripts/add-client.sh, crates/cli/src/launcher.rs, .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md]
- Build on Phase 7 `prepare-runtime`; do not weaken the additive help/error messaging already established in `standalone-cli/`. [VERIFIED: user request, standalone-cli/src/cli.ts, standalone-cli/src/output.ts, .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md]
- Treat the late Phase 7 review findings as planning inputs for Phase 8 safety: repo-root path resolution, health request timeout enforcement, stale PID shutdown safety, and symlink escape risk in workspace guards. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts, standalone-cli/src/environment/workspace.ts]
- This phase must satisfy `RUN-01`, `RUN-02`, `RUN-03`, and `RUN-04`. [VERIFIED: user request, .planning/REQUIREMENTS.md, .planning/ROADMAP.md]

### Claude's Discretion

- The final CLI UX is not locked yet: Phase 8 can either make bare invocation perform prepare-and-launch or introduce an explicit launch subcommand, as long as arbitrary Claude args still pass through unchanged from the standalone CLI surface. [VERIFIED: standalone-cli/src/cli.ts, .planning/ROADMAP.md] [ASSUMED]
- The launch helper module layout inside `standalone-cli/src/` is not locked yet. [VERIFIED: standalone-cli/src/, init phase-op output] [ASSUMED]

### Deferred Ideas (OUT OF SCOPE)

- Editing or replacing the legacy TypeScript launcher scripts or Rust launcher code is out of scope for this phase. [VERIFIED: user request, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md]
- Desktop onboarding, remote deployment, launcher installation, shell alias hijack/release flows, and multi-client distribution remain out of scope for this isolated CLI phase. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md, scripts/add-client.sh]
- Broad operator docs and full milestone validation remain Phase 9 work, even though Phase 8 should create the launch-test surface they will rely on. [VERIFIED: .planning/ROADMAP.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | After environment bootstrap succeeds, the new CLI locates the locally installed `claude` executable and launches it automatically. [VERIFIED: .planning/REQUIREMENTS.md] | Reuse `prepareRuntimeEnvironment()` first, then launch `claude` as a child process from Node instead of generating a shell launcher file. [VERIFIED: standalone-cli/src/environment/prepare.ts, standalone-cli/src/cli.ts, scripts/add-client.sh] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| RUN-02 | The launched Claude process receives the required gateway-oriented environment variables without manual operator setup. [VERIFIED: .planning/REQUIREMENTS.md] | Build the child-process env from the prepared manifest/runtime summary and inject the four legacy launcher vars explicitly. [VERIFIED: standalone-cli/src/environment/types.ts, scripts/add-client.sh, crates/cli/src/launcher.rs] |
| RUN-03 | Arbitrary Claude command-line arguments pass through the new CLI unchanged. [VERIFIED: .planning/REQUIREMENTS.md] | Pass `argv` as the `args` array to `spawn()` with `shell: false` semantics instead of building a shell command string. [VERIFIED: standalone-cli/src/cli.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| RUN-04 | If Claude Code is not installed or cannot be executed, the new CLI exits with actionable installation or PATH guidance instead of reporting partial success. [VERIFIED: .planning/REQUIREMENTS.md] | Treat child-process `error` and non-zero exit paths as launch failure states, and map missing-command errors to install/PATH guidance that references the Claude Code npm package. [VERIFIED: scripts/add-client.sh, standalone-cli/src/index.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] [CITED: https://www.npmjs.com/package/%40anthropic-ai/claude-code] |
</phase_requirements>

## Summary

The current standalone CLI stops at readiness. `runCli()` only handles help, `discover-credentials`, and `prepare-runtime`; it explicitly rejects passthrough args for `prepare-runtime`, and there is no Phase 8 launch path yet. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/output.ts, standalone-cli/tests/runtime-preparation.test.ts]

Phase 7 already produced the right substrate for launch handoff: bootstrap writes a standalone-owned manifest/config, `prepareRuntimeEnvironment()` persists runtime metadata, and `ensureGatewayRuntime()` reuses or starts the gateway only after `/_health` succeeds. That means Phase 8 should be a thin handoff layer on top of the existing bootstrap and runtime-preparation surface, not a second bootstrap path. [VERIFIED: standalone-cli/src/environment/bootstrap.ts, standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/runtime.ts, .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md]

The planning-critical issue is safety sequencing. The current Phase 7 substrate still has four gaps that matter before automatic launch is allowed: runtime build/spawn uses caller `cwd` instead of a stable repo-root resolver; health polling uses `http.request()` without an explicit per-request timeout; stale runtime shutdown is a raw `process.kill(pid, 'SIGTERM')`; and workspace guards use `resolve()` plus `relative()` without symlink-aware checks. Phase 8 should plan these as Wave 0 hardening tasks before adding the actual `claude` handoff. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts, standalone-cli/src/environment/workspace.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/http.html] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]

**Primary recommendation:** Plan Phase 8 as two layers: first harden the existing prepare-runtime substrate for repo-root resolution, request timeout enforcement, stale-PID safety, and symlink-aware workspace ownership; then add a direct Node child-process launch helper that reuses `prepareRuntimeEnvironment()`, injects the four required env vars, forwards `argv` unchanged, inherits stdio, and converts missing-command or spawn failures into install/PATH guidance. [VERIFIED: user request, standalone-cli/src/environment/prepare.ts, scripts/add-client.sh, crates/cli/src/launcher.rs] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `child_process.spawn()` | Local Node is `v22.19.0`. [VERIFIED: local command] | Launch `claude` with inherited stdio, explicit env, and array-based arg passthrough. [VERIFIED: standalone-cli/src/index.ts, standalone-cli/src/cli.ts] | The official API supports `args`, `cwd`, and `env`, and emits `ENOENT` when the command does not exist. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| Existing Phase 7 `prepareRuntimeEnvironment()` plus manifest/runtime summary types | Current repo implementation. [VERIFIED: standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/types.ts] | Prepare or reuse the gateway runtime before any launch occurs. [VERIFIED: standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/runtime.ts] | Reusing the proven Phase 7 surface avoids a second bootstrap/runtime path. [VERIFIED: .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md] |
| Explicit env injection using the legacy four-variable contract | Current legacy launcher behavior. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs] | Ensure Claude points at the local gateway without manual shell setup. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs] | This is the exact must-port contract recorded in the Phase 5 inventory. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md] |
| No new npm dependency | Current standalone package has no runtime dependencies beyond the repo toolchain. [VERIFIED: standalone-cli/package.json] | Preserve the “no new dependencies without explicit request” rule while implementing Phase 8 entirely inside Node stdlib plus existing Phase 7 modules. [VERIFIED: standalone-cli/package.json, AGENTS.md] | The required launch primitives already exist in Node and the repo. [VERIFIED: standalone-cli/src/environment/runtime.ts, scripts/add-client.sh] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node built-in `http.request()` timeout support | Available in current Node docs. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/http.html] | Enforce client-side timeout on health polling so one hung socket does not bypass the overall readiness budget. [VERIFIED: standalone-cli/src/environment/runtime.ts] | Use while hardening Phase 7 runtime checks before enabling automatic launch. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts] |
| `npx tsx` direct test runner | Local `npx` is `10.9.3`; existing tests already run this way. [VERIFIED: local command, standalone-cli/package.json] | Keep launch tests package-local and fast. [VERIFIED: standalone-cli/package.json, standalone-cli/tests/*.test.ts] | Use for all new Phase 8 unit-style tests. [VERIFIED: standalone-cli/tests/cli-help.test.ts, standalone-cli/tests/runtime-preparation.test.ts] |
| `claude` executable | Local binary exists at `/Users/kay/.local/bin/claude`; version `2.1.92 (Claude Code)`. [VERIFIED: local command] | Real launch target and optional manual smoke dependency. [VERIFIED: local command, .planning/ROADMAP.md] | Phase 8 automation should not require the live binary, but manual smoke can use it. [VERIFIED: .planning/ROADMAP.md, standalone-cli/tests/runtime-preparation.test.ts] |
| `security` and `curl` CLIs | Both are available locally. [VERIFIED: local command] | Credential discovery and manual health smoke remain useful surrounding tools. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts, scripts/add-client.sh] | Use only for manual smoke or the already-implemented Phase 6 discovery adapter; Phase 8 launch itself should stay inside Node. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts, scripts/add-client.sh] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `spawn('claude', args, { stdio: 'inherit', env })` with shell disabled by default. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] | Build a shell string like `exec claude "$@"`. [VERIFIED: scripts/add-client.sh] | Rejected because shell composition weakens argument safety and makes “unchanged passthrough” harder to prove in tests. [VERIFIED: scripts/add-client.sh] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| Reuse `prepareRuntimeEnvironment()` as the launch prerequisite. [VERIFIED: standalone-cli/src/environment/prepare.ts] | Duplicate runtime boot logic inside the launch path. | Rejected because it would split readiness logic and drift from Phase 7’s verified contract. [VERIFIED: .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md, standalone-cli/src/environment/runtime.ts] |
| Keep launch inside the standalone CLI process. [VERIFIED: user request, standalone-cli/src/index.ts] | Generate a new shell launcher file in `~/.ccgw/standalone-cli/`. | Rejected because Phase 8 only needs in-process handoff, not a return to legacy launcher-file ergonomics. [VERIFIED: .planning/ROADMAP.md, scripts/add-client.sh] |

**Installation:** No new package installation is required for Phase 8 implementation itself. Missing `claude` guidance should point operators to the Claude Code npm package install flow. [VERIFIED: standalone-cli/package.json, scripts/add-client.sh] [CITED: https://www.npmjs.com/package/%40anthropic-ai/claude-code]

```bash
npm install -g @anthropic-ai/claude-code
```

**Version verification:** No new npm package should be added for this phase, so there is no Phase 8 package-version decision to verify beyond the existing repo toolchain and the external `claude` binary presence. [VERIFIED: standalone-cli/package.json, local command]

## Architecture Patterns

### Recommended Project Structure

```text
standalone-cli/
├── src/
│   ├── cli.ts
│   ├── output.ts
│   ├── launch/
│   │   ├── claude.ts
│   │   └── env.ts
│   └── environment/
│       ├── prepare.ts
│       ├── runtime.ts
│       └── workspace.ts
└── tests/
    ├── claude-launch.test.ts
    ├── runtime-preparation.test.ts
    └── cli-help.test.ts
```

This keeps the new handoff logic isolated, preserves the existing Phase 7 modules, and gives Phase 8 a bounded write scope entirely inside `standalone-cli/`. [VERIFIED: user request, standalone-cli/src/, standalone-cli/tests/]

### Pattern 1: Treat Launch as a Thin Wrapper Over `prepare-runtime`

**What:** The launch path should call credential discovery, then `prepareRuntimeEnvironment()`, then launch Claude only after readiness succeeds. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/environment/prepare.ts, .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md]  
**When to use:** Every Phase 8 launch path, including interactive no-arg use and passthrough-arg use. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md]  
**Why:** Phase 7 already encoded the health gate and manifest persistence; duplicating that logic would create new divergence risk. [VERIFIED: standalone-cli/src/environment/runtime.ts, standalone-cli/tests/runtime-preparation.test.ts]  
**Example:**

```typescript
const discovery = await discoverCredentials()
if (!discovery.ok) return fail(renderDiscoveryFailure(discovery))

const prepared = await prepareRuntimeEnvironment(discovery.credentials)
return launchClaude(argv, buildClaudeEnv(prepared))
```

Source basis: this composes the existing Phase 6 and Phase 7 surfaces instead of replacing them. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/environment/prepare.ts]

### Pattern 2: Use Direct Child-Process Launch, Not a Shell Wrapper

**What:** Launch Claude with `spawn()` and an argument array, letting Node handle PATH lookup for the command. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]  
**When to use:** For the actual Claude handoff. [VERIFIED: .planning/ROADMAP.md]  
**Why:** Node documents `ENOENT` behavior for missing commands and already supports `env`, `cwd`, and inherited stdio. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]  
**Example:**

```typescript
import { spawn } from 'node:child_process'

export function launchClaude(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      env,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })
}
```

Source basis: the legacy shell launcher uses `exec claude "$@"`; this is the equivalent Node-native pattern for the isolated package. [VERIFIED: scripts/add-client.sh] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]

### Pattern 3: Centralize the Launch Env Contract

**What:** Build the Claude child env in one helper that starts from the parent env, preserves proxy vars from Phase 7, and overlays the four gateway-specific variables explicitly. [VERIFIED: standalone-cli/src/environment/proxy-env.ts, scripts/add-client.sh, crates/cli/src/launcher.rs]  
**When to use:** Immediately before spawning Claude. [VERIFIED: scripts/add-client.sh]  
**Why:** Centralizing this prevents drift between help text, tests, and the actual launched process env. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs, standalone-cli/src/output.ts]  
**Example:**

```typescript
function buildClaudeEnv(baseEnv: NodeJS.ProcessEnv, gatewayUrl: string, clientToken: string): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ANTHROPIC_BASE_URL: gatewayUrl,
    ANTHROPIC_API_KEY: clientToken,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: 'false',
  }
}
```

Source basis: this matches both legacy launcher surfaces exactly. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs]

### Pattern 4: Resolve the Repo Root Independently of `process.cwd()`

**What:** Runtime build/spawn helpers should resolve the repository root from the module location or another stable package-owned anchor, not from the caller’s current directory. [VERIFIED: standalone-cli/src/environment/runtime.ts] [ASSUMED]  
**When to use:** Before any `npm run build` or `node dist/index.js <configPath>` call that targets the repo-root gateway runtime. [VERIFIED: standalone-cli/src/environment/runtime.ts, package.json]  
**Why:** The current code uses `resolve(options.cwd ?? process.cwd())`, which is only safe if the caller is already in the repo root. [VERIFIED: standalone-cli/src/environment/runtime.ts]  
**Example:**

```typescript
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')
```

This relative-path strategy matches the current package layout in both `src/` and compiled `dist/`. [VERIFIED: standalone-cli/src/environment/runtime.ts, standalone-cli/src/index.ts] [ASSUMED]

### Anti-Patterns to Avoid

- **Launching before `prepareRuntimeEnvironment()` completes:** This would reintroduce the exact “partial success” failure mode Phase 7 was built to avoid. [VERIFIED: .planning/STATE.md, standalone-cli/src/environment/prepare.ts]
- **Using a shell command string for passthrough args:** This weakens the proof that arguments remain unchanged. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]
- **Writing a new launcher file as a Phase 8 shortcut:** The requirement is automatic handoff from the new CLI, not a return to legacy file-generation flows. [VERIFIED: .planning/ROADMAP.md, scripts/add-client.sh]
- **Reporting success before Claude actually starts or before its failure path is known:** `RUN-04` explicitly rejects partial-success reporting. [VERIFIED: .planning/REQUIREMENTS.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument passthrough | Shell-escaped command strings. | `spawn('claude', args, { stdio: 'inherit', env })`. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] | Array args are the standard safe primitive for unchanged passthrough. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| Launch environment | Ad hoc env setting in multiple CLI branches. | One `buildClaudeEnv()` helper backed by the four legacy vars. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs] | The contract already exists and must remain exact. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md] |
| Runtime boot logic | A second prepare/start path inside the launch helper. | Reuse `prepareRuntimeEnvironment()` as the single readiness gate. [VERIFIED: standalone-cli/src/environment/prepare.ts] | Prevents divergence from the verified Phase 7 substrate. [VERIFIED: .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md] |
| Workspace safety | String-only path checks with no symlink awareness. | Harden `assertWorkspacePath()` with symlink-aware checks before Phase 8 launch depends on it. [VERIFIED: standalone-cli/src/environment/workspace.ts] [ASSUMED] | Current checks are not sufficient against symlink escape by themselves. [VERIFIED: standalone-cli/src/environment/workspace.ts] [ASSUMED] |
| Missing-command handling | Generic `Fatal:` wrappers with no install/PATH actionability. | Dedicated missing-`claude` guidance that mentions install and PATH refresh. [VERIFIED: standalone-cli/src/index.ts, scripts/add-client.sh] [CITED: https://www.npmjs.com/package/%40anthropic-ai/claude-code] | `RUN-04` requires actionable recovery, not generic failure text. [VERIFIED: .planning/REQUIREMENTS.md] |

**Key insight:** Phase 8 is not “build a launcher from scratch.” It is “compose the already-verified discovery and runtime layers with one small, well-tested Node process handoff.” [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/environment/prepare.ts, .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md]

## Common Pitfalls

### Pitfall 1: Repo-Root Resolution Depends on Caller `cwd`

**What goes wrong:** `prepare-runtime` can build or spawn the wrong path when the CLI is invoked outside the repo root. [VERIFIED: standalone-cli/src/environment/runtime.ts]  
**Why it happens:** `ensureGatewayRuntime()` resolves `cwd` from `options.cwd ?? process.cwd()` and then expects repo-root `dist/index.js` plus root `npm run build` to exist there. [VERIFIED: standalone-cli/src/environment/runtime.ts, package.json]  
**How to avoid:** Make repo-root discovery a stable helper and treat it as a Phase 8 prerequisite hardening task before launch work. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts] [ASSUMED]  
**Warning signs:** A launch flow works from the repo root but fails from another directory with missing `dist/index.js` or a wrong build target. [VERIFIED: standalone-cli/src/environment/runtime.ts] [ASSUMED]

### Pitfall 2: Health Polling Has No Explicit Per-Request Timeout

**What goes wrong:** A single stuck health request can consume the readiness loop without enforcing a client-side timeout budget. [VERIFIED: standalone-cli/src/environment/runtime.ts]  
**Why it happens:** `defaultCheckHealth()` creates an `http.request()` but does not pass a timeout option or abort behavior. [VERIFIED: standalone-cli/src/environment/runtime.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/http.html]  
**How to avoid:** Add request-level timeout or abort handling in Phase 8 Wave 0, then keep the existing overall `timeoutMs` loop on top of it. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts] [ASSUMED]  
**Warning signs:** Readiness hangs longer than the configured `timeoutMs` under socket stalls or bad local proxy conditions. [VERIFIED: standalone-cli/src/environment/runtime.ts] [ASSUMED]

### Pitfall 3: Stale PID Shutdown Can Target the Wrong Process

**What goes wrong:** A reused PID in manifest runtime metadata could send `SIGTERM` to an unrelated process. [VERIFIED: standalone-cli/src/environment/runtime.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]  
**Why it happens:** The current stop path is `process.kill(pid, 'SIGTERM')` with no verification beyond PID presence. [VERIFIED: standalone-cli/src/environment/runtime.ts]  
**How to avoid:** Plan a runtime-ownership check before kill or another safer stale-runtime strategy as a prerequisite hardening task. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts] [ASSUMED]  
**Warning signs:** Manifest runtime metadata survives across shell sessions or machine restarts, then `prepare-runtime` tries to stop a PID it did not spawn in the current lifecycle. [VERIFIED: standalone-cli/src/environment/types.ts, standalone-cli/src/environment/runtime.ts] [ASSUMED]

### Pitfall 4: Workspace Guards Are Not Symlink-Aware

**What goes wrong:** A path that appears inside `~/.ccgw/standalone-cli` by string comparison can still escape through symlink traversal. [VERIFIED: standalone-cli/src/environment/workspace.ts] [ASSUMED]  
**Why it happens:** `assertWorkspacePath()` uses `resolve()`, `relative()`, and `isAbsolute()`, but it does not use `realpath()` or symlink checks. [VERIFIED: standalone-cli/src/environment/workspace.ts]  
**How to avoid:** Harden workspace ownership checks before Phase 8 launch depends on manifest/config reads and writes. [VERIFIED: user request, standalone-cli/src/environment/workspace.ts] [ASSUMED]  
**Warning signs:** Tests only cover ordinary paths and never exercise symlinked workspace roots or symlinked manifest/config targets. [VERIFIED: standalone-cli/tests/environment-bootstrap.test.ts, standalone-cli/src/environment/workspace.ts]

### Pitfall 5: The Command Surface Must Change Deliberately

**What goes wrong:** Phase 8 can accidentally preserve the Phase 7 “no args means help” behavior and fail to provide transparent Claude passthrough. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/tests/cli-help.test.ts]  
**Why it happens:** `shouldRenderHelp()` currently returns true for `argv.length === 0`, and the help/output text still describes a pre-launch scope. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/output.ts, standalone-cli/README.md]  
**How to avoid:** Lock the intended Phase 8 command-routing rule in the plan before implementation starts. [VERIFIED: standalone-cli/src/cli.ts] [ASSUMED]  
**Warning signs:** A proposed implementation adds launch support but still treats `ccgw-standalone-cli --print hi` as an unknown command path instead of Claude passthrough. [VERIFIED: standalone-cli/src/cli.ts] [ASSUMED]

## Code Examples

Verified patterns from official and repo sources:

### Direct Claude Launch with Actionable Missing-Command Handling

```typescript
import { spawn } from 'node:child_process'

export async function launchClaude(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env, stdio: 'inherit' })

    child.once('error', (error) => {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            "Claude Code was not found in PATH. Install it with 'npm install -g @anthropic-ai/claude-code' and restart your shell.",
          ),
        )
        return
      }

      reject(error)
    })

    child.once('exit', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })
}
```

Source: Node child-process docs for `spawn()` error and env behavior, plus the legacy CC Gateway launcher contract for the `claude` command target and install guidance. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] [CITED: https://www.npmjs.com/package/%40anthropic-ai/claude-code] [VERIFIED: scripts/add-client.sh]

### Launch Env Builder That Preserves the Legacy Contract

```typescript
export function buildClaudeEnv(baseEnv: NodeJS.ProcessEnv, gatewayUrl: string, clientToken: string): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ANTHROPIC_BASE_URL: gatewayUrl,
    ANTHROPIC_API_KEY: clientToken,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: 'false',
  }
}
```

Source: both legacy launcher surfaces set these exact keys. [VERIFIED: scripts/add-client.sh, crates/cli/src/launcher.rs]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generated shell launcher file under `clients/cc-*` that eventually `exec`s `claude "$@"`. [VERIFIED: scripts/add-client.sh] | Isolated standalone CLI should launch `claude` directly in-process after Phase 7 readiness succeeds. [VERIFIED: .planning/ROADMAP.md, standalone-cli/src/cli.ts] | The milestone shift was recorded by the v1.1 standalone CLI roadmap on 2026-04-08. [VERIFIED: .planning/ROADMAP.md, .planning/PROJECT.md] | Phase 8 should not reintroduce launcher-file generation. [VERIFIED: .planning/ROADMAP.md] |
| Help-only / readiness-only standalone command surface. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/tests/cli-help.test.ts] | Launch-capable CLI surface with transparent Claude arg passthrough. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md] | Phase 8 is the first phase that owns this behavior. [VERIFIED: .planning/ROADMAP.md] | Planning must explicitly change command routing and tests together. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/tests/cli-help.test.ts] |
| Readiness checked before launch by external shell status flows. [VERIFIED: scripts/add-client.sh] | Readiness is already handled inside `prepareRuntimeEnvironment()`. [VERIFIED: standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/runtime.ts] | Completed in Phase 7 on 2026-04-08. [VERIFIED: .planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md] | Phase 8 should compose this instead of duplicating it. [VERIFIED: standalone-cli/src/environment/prepare.ts] |

**Deprecated/outdated:**

- `standalone-cli/README.md` still says the package does not yet cover runtime preparation or launch behavior, but `prepare-runtime` already exists in code. Phase 8 should update help/README text to match the actual command surface it introduces. [VERIFIED: standalone-cli/README.md, standalone-cli/src/cli.ts, standalone-cli/src/output.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bare invocation should probably become the Phase 8 prepare-and-launch path so Claude args can pass through naturally. [ASSUMED] | User Constraints, Common Pitfalls | Medium: if the UX instead requires an explicit `launch` subcommand, the CLI routing and help changes will differ. |
| A2 | Repo-root discovery should be hardened by resolving from module location rather than caller `cwd`. [ASSUMED] | Architecture Patterns, Common Pitfalls | Medium: if another stable anchor is preferred, implementation details change but the need for a stable resolver does not. |
| A3 | Symlink-aware checks should use `realpath()` or equivalent ownership validation before Phase 8 launch depends on workspace files. [ASSUMED] | Don't Hand-Roll, Common Pitfalls | Medium: without a concrete mitigation, the planner may miss the prerequisite hardening task. |
| A4 | Stale-PID handling should verify runtime ownership before signaling or adopt another safer restart strategy. [ASSUMED] | Common Pitfalls, Security Domain | Medium: if left unaddressed, automatic launch could inherit a dangerous restart path. |

## Open Questions

1. **Should `ccgw-standalone-cli` with no args launch interactive Claude or still print help?** [VERIFIED: standalone-cli/src/cli.ts]  
   What we know: current no-arg behavior is help, but `RUN-03` asks for transparent Claude arg passthrough and the legacy launcher uses bare invocation for interactive launch. [VERIFIED: standalone-cli/src/cli.ts, scripts/add-client.sh, .planning/REQUIREMENTS.md]  
   What's unclear: no Phase 8 context file locks the UX. [VERIFIED: init phase-op output]  
   Recommendation: decide this in the Phase 8 plan up front; the leanest operator UX is bare invocation for launch and explicit subcommands only for help or readiness-only operations. [ASSUMED]

2. **Should the four prerequisite hardening items be part of Phase 8 Wave 0 or split into a new inserted phase?** [VERIFIED: user request]  
   What we know: the user explicitly asked Phase 8 research to account for them as planning inputs before safe launch work. [VERIFIED: user request]  
   What's unclear: whether the planner should sequence them inside Phase 8 or propose a decimal insertion.  
   Recommendation: keep them inside Phase 8 as Wave 0 unless the hardening diff becomes large enough to deserve its own verification artifact. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | standalone CLI execution and root gateway runtime. [VERIFIED: standalone-cli/src/index.ts, standalone-cli/src/environment/runtime.ts, package.json] | ✓ [VERIFIED: local command] | `v22.19.0` [VERIFIED: local command] | — |
| npm | root gateway build path from `ensureGatewayRuntime()`. [VERIFIED: standalone-cli/src/environment/runtime.ts, package.json] | ✓ [VERIFIED: local command] | `10.9.3` [VERIFIED: local command] | None for the current implementation. [VERIFIED: standalone-cli/src/environment/runtime.ts] |
| npx | package-local tests. [VERIFIED: standalone-cli/package.json] | ✓ [VERIFIED: local command] | `10.9.3` [VERIFIED: local command] | — |
| `claude` binary | actual Phase 8 launch target. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md] | ✓ [VERIFIED: local command] | `2.1.92 (Claude Code)` [VERIFIED: local command] | Missing-command path must print install/PATH guidance. [VERIFIED: .planning/REQUIREMENTS.md, scripts/add-client.sh] |
| `/usr/bin/security` | existing Phase 6 credential discovery on macOS. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts] | ✓ [VERIFIED: local command] | system tool [VERIFIED: local command] | `~/.claude/.credentials.json` fallback in Phase 6 discovery. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts] |
| `curl` | manual `_health` smoke only. [VERIFIED: scripts/add-client.sh] | ✓ [VERIFIED: local command] | system tool [VERIFIED: local command] | Node health checks already exist in code. [VERIFIED: standalone-cli/src/environment/runtime.ts] |

**Missing dependencies with no fallback:**

- None for planning. The repo has the toolchain needed to plan and test the Phase 8 implementation surface. [VERIFIED: local command, standalone-cli/tests/*.test.ts]

**Missing dependencies with fallback:**

- `~/.claude/.credentials.json` is missing on this machine, but Phase 6 discovery already prefers macOS Keychain first and only uses the file as fallback. No live Keychain smoke was run in this research session. [VERIFIED: local command, standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/credential-discovery/sources/credentials-file.ts]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node `assert` tests executed with `npx tsx`. [VERIFIED: standalone-cli/tests/cli-help.test.ts, standalone-cli/tests/runtime-preparation.test.ts, local command] |
| Config file | none; tests are direct executable `.ts` files. [VERIFIED: standalone-cli/package.json, standalone-cli/tests/*.test.ts] |
| Quick run command | `npx tsx standalone-cli/tests/claude-launch.test.ts` [ASSUMED] |
| Full suite command | `npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts` [VERIFIED: existing test commands] [ASSUMED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | Launch path calls discovery, prepare-runtime, then spawns `claude` when the runtime is ready. [VERIFIED: .planning/REQUIREMENTS.md, standalone-cli/src/cli.ts] | unit/integration-with-adapters | `npx tsx standalone-cli/tests/claude-launch.test.ts` [ASSUMED] | ❌ Wave 0 |
| RUN-02 | Child env includes the four required gateway vars and preserves inherited env where intended. [VERIFIED: .planning/REQUIREMENTS.md, scripts/add-client.sh] | unit | `npx tsx standalone-cli/tests/claude-launch.test.ts` [ASSUMED] | ❌ Wave 0 |
| RUN-03 | Claude args pass through unchanged as an array, including flags and values. [VERIFIED: .planning/REQUIREMENTS.md] | unit | `npx tsx standalone-cli/tests/claude-launch.test.ts` [ASSUMED] | ❌ Wave 0 |
| RUN-04 | Missing `claude`, spawn errors, and non-zero exits return actionable failure output instead of partial success. [VERIFIED: .planning/REQUIREMENTS.md] | unit | `npx tsx standalone-cli/tests/claude-launch.test.ts` [ASSUMED] | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx tsx standalone-cli/tests/claude-launch.test.ts` plus the directly affected existing suite, usually `runtime-preparation.test.ts` or `cli-help.test.ts`. [VERIFIED: existing test files] [ASSUMED]
- **Per wave merge:** Run the full standalone CLI test set, including the new launch test. [VERIFIED: standalone-cli/tests/*.test.ts] [ASSUMED]
- **Phase gate:** Full standalone CLI suite green, plus one manual smoke on a machine with a real Claude login and real `claude` installation. [VERIFIED: .planning/REQUIREMENTS.md, .planning/phases/06-standalone-cli-scaffold-credential-discovery/VERIFICATION.md] [ASSUMED]

### Wave 0 Gaps

- [ ] `standalone-cli/tests/claude-launch.test.ts` — launch orchestration, env injection, unchanged arg passthrough, missing-command guidance, and child exit propagation. [VERIFIED: no such file in current tree] [ASSUMED]
- [ ] Launch adapter injection seam in `standalone-cli/src/cli.ts` or a new `standalone-cli/src/launch/claude.ts` so tests can stub spawn behavior without a real Claude install. [VERIFIED: standalone-cli/src/cli.ts] [ASSUMED]
- [ ] Help-text assertions need a Phase 8 update once the command surface stops being readiness-only. [VERIFIED: standalone-cli/tests/cli-help.test.ts, standalone-cli/src/output.ts]
- [ ] Optional package script such as `test:launch` or `test` aggregator would make the standalone suite easier to run repeatedly, but it is not a hard blocker if Phase 8 keeps direct `npx tsx` commands. [VERIFIED: standalone-cli/package.json] [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no [VERIFIED: phase scope in .planning/ROADMAP.md] | Existing gateway/OAuth auth is reused; Phase 8 does not introduce new user auth. [VERIFIED: standalone-cli/src/environment/prepare.ts, src/auth.ts, src/oauth.ts] |
| V3 Session Management | no [VERIFIED: phase scope in .planning/ROADMAP.md] | Session lifecycle remains in existing gateway/OAuth code, not the launch handoff. [VERIFIED: src/oauth.ts, .planning/ROADMAP.md] |
| V4 Access Control | no [VERIFIED: phase scope in .planning/ROADMAP.md] | Phase 8 is a local launcher path, not a multi-user authorization surface. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md] |
| V5 Input Validation | yes [VERIFIED: launch path takes external argv and local manifest/runtime state] | Validate command routing explicitly, keep argv as an array, and reject malformed runtime state/actionable errors. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/environment/runtime.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| V6 Cryptography | no [VERIFIED: phase scope in .planning/ROADMAP.md] | Phase 8 reuses existing generated tokens and OAuth state; it should not introduce new crypto primitives. [VERIFIED: standalone-cli/src/environment/tokens.ts, standalone-cli/src/environment/bootstrap.ts] |

### Known Threat Patterns for Phase 8

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection through passthrough args. [VERIFIED: phase requirement plus launch scope] | Tampering | Use `spawn()` with argv array and no shell command construction. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] |
| Token leakage through logs or failure output. [VERIFIED: existing secret-safe output contract] | Information Disclosure | Reuse the current secret-safe output style and never echo `ANTHROPIC_API_KEY` or raw OAuth values. [VERIFIED: standalone-cli/src/output.ts, .planning/phases/06-standalone-cli-scaffold-credential-discovery/VERIFICATION.md] |
| Launching Claude against an unhealthy or stale gateway runtime. [VERIFIED: .planning/STATE.md, Phase 7 runtime contract] | Denial of Service | Always call `prepareRuntimeEnvironment()` first and keep the `/_health` gate intact. [VERIFIED: standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/runtime.ts] |
| Killing an unrelated process because manifest PID metadata is stale. [VERIFIED: standalone-cli/src/environment/runtime.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] | Denial of Service | Harden stale-runtime shutdown before launch is automated. [VERIFIED: user request] [ASSUMED] |
| Path escape through symlinked workspace files. [VERIFIED: standalone-cli/src/environment/workspace.ts] [ASSUMED] | Tampering | Add symlink-aware workspace ownership validation before Phase 8 launch depends on manifest/config reads and writes. [VERIFIED: user request, standalone-cli/src/environment/workspace.ts] [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Repo files: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `standalone-cli/src/cli.ts`, `standalone-cli/src/output.ts`, `standalone-cli/src/environment/prepare.ts`, `standalone-cli/src/environment/runtime.ts`, `standalone-cli/src/environment/workspace.ts`, `standalone-cli/src/environment/types.ts`, `standalone-cli/tests/*.test.ts`, `scripts/add-client.sh`, `crates/cli/src/launcher.rs`, `package.json`. [VERIFIED: repo files]
- Node.js `child_process` docs: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html [CITED]
- Node.js `http` docs: https://nodejs.org/download/release/v22.19.0/docs/api/http.html [CITED]
- Claude Code npm package page: https://www.npmjs.com/package/%40anthropic-ai/claude-code [CITED]

### Secondary (MEDIUM confidence)

- None. All critical claims above are grounded in repo files, local environment probes, or official documentation. [VERIFIED: research session evidence]

### Tertiary (LOW confidence)

- None. [VERIFIED: research session evidence]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - the phase can stay on existing Node stdlib plus the already-implemented Phase 7 modules. [VERIFIED: standalone-cli/package.json, standalone-cli/src/environment/*.ts, Node docs]
- Architecture: HIGH - the repo already exposes the exact layers Phase 8 needs to compose, and the remaining work is bounded. [VERIFIED: standalone-cli/src/cli.ts, standalone-cli/src/environment/prepare.ts, standalone-cli/src/environment/runtime.ts]
- Pitfalls: HIGH - the four prerequisite hardening items are visible in current code and explicitly called out by the user. [VERIFIED: user request, standalone-cli/src/environment/runtime.ts, standalone-cli/src/environment/workspace.ts]

**Research date:** 2026-04-08 [VERIFIED: local date]  
**Valid until:** 2026-05-08 for repo-state research; re-check official Node/npm docs sooner if the implementation starts after that window. [VERIFIED: current date] [ASSUMED]
