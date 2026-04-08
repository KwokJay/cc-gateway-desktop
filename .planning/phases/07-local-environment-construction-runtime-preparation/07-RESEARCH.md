# Phase 07: Local Environment Construction & Runtime Preparation - Research

**Researched:** 2026-04-08 [VERIFIED: repo files]  
**Domain:** isolated bootstrap artifact synthesis, idempotent workspace ownership, proxy-safe runtime preparation [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md, standalone-cli/README.md]  
**Confidence:** MEDIUM [VERIFIED: repo files] [ASSUMED]

## User Constraints

No `07-CONTEXT.md` exists for this phase, so the constraints below come from the explicit user request, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, Phase 05 boundary artifacts, and the current standalone CLI package state. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/README.md]

### Locked Decisions

- Implementation must stay inside the new isolated standalone CLI path/package and must not modify protected legacy paths: `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/README.md]
- Preserve the real bootstrap, config, proxy, auth, and runtime contracts from the legacy scripts and config examples, but do not blindly copy their shell implementation details. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh, config.example.yaml]
- Keep live secrets safe; never print raw OAuth tokens or client tokens unnecessarily. [VERIFIED: .planning/PROJECT.md, .planning/STATE.md, standalone-cli/src/output.ts, standalone-cli/tests/credential-discovery.test.ts]
- Focus this phase on bootstrap artifact generation/reuse, idempotent local workspace/config handling, proxy env propagation, and runtime preparation before later Phase 8 handles actual Claude launch. [VERIFIED: user request, .planning/ROADMAP.md, standalone-cli/README.md]
- This phase must satisfy `ENV-02`, `ENV-03`, `ENV-04`, and `ENV-05`. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md]
- Code, scripts, config, and tests are the source of truth when README narrative drifts. [VERIFIED: .planning/PROJECT.md, .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md]

### Claude's Discretion

- The exact CLI-owned workspace path is not locked by a phase context file. [ASSUMED]
- The exact manifest schema for generated bootstrap state is not locked by a phase context file. [ASSUMED]
- The package-internal module split for environment construction and runtime preparation is not locked yet, as long as it remains inside `standalone-cli/`. [ASSUMED]

### Deferred Ideas (OUT OF SCOPE)

- Actual `claude` process launch, environment injection, and argument passthrough belong to Phase 8. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md]
- Remote deployment, Docker-first admin flows, TLS cert generation, and multi-client distribution remain deferred from this local-machine phase slice. [VERIFIED: .planning/ROADMAP.md, .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md]
- Full operator documentation and broad automated coverage are Phase 9 work, though this research identifies the missing Wave 0 test files Phase 7 should create. [VERIFIED: .planning/ROADMAP.md, standalone-cli/tests/]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENV-02 | New CLI can generate or reuse canonical identity, client token, and local config or workspace artifacts needed for a local Claude-through-gateway session without editing the existing TypeScript or Rust applications. [VERIFIED: .planning/REQUIREMENTS.md] | The recommended design uses a CLI-owned workspace plus generated `config.yaml` that preserves the legacy contract while avoiding repo-root `config.yaml` and `clients/` artifacts. [VERIFIED: src/index.ts, src/config.ts, scripts/quick-setup.sh, scripts/add-client.sh] [ASSUMED] |
| ENV-03 | Re-running the new CLI on the same machine is idempotent and does not duplicate or corrupt previously generated bootstrap artifacts. [VERIFIED: .planning/REQUIREMENTS.md] | The recommended design keeps durable bootstrap state in a JSON manifest and re-renders generated config from that source of truth instead of appending YAML entries on each run. [VERIFIED: scripts/add-client.sh, scripts/quick-setup.sh] [ASSUMED] |
| ENV-04 | New CLI honors local outbound proxy settings expressed through the existing `HTTPS_PROXY` / `HTTP_PROXY` style environment variables. [VERIFIED: .planning/REQUIREMENTS.md] | The recommended design preserves proxy env by inheriting the parent environment when spawning the runtime process, matching the legacy `src/proxy-agent.ts` precedence. [VERIFIED: src/proxy-agent.ts, src/oauth.ts, src/proxy.ts] [ASSUMED] |
| ENV-05 | New CLI prepares or starts the local runtime state required by the generated environment before Claude Code launch begins. [VERIFIED: .planning/REQUIREMENTS.md] | The recommended design treats runtime readiness as a health-gated step: build/reuse the gateway runtime, start it with the generated config path, and poll `/_health` until it returns ready before Phase 8 launch begins. [VERIFIED: src/index.ts, src/proxy.ts, package.json] [ASSUMED] |
</phase_requirements>

## Summary

Phase 7 should stop thinking in terms of repo-root shell side effects and instead make the standalone CLI the owner of a dedicated local workspace. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/README.md] The legacy scripts generate `config.yaml` in the repo root, create `clients/cc-*` launcher files, and append tokens directly into YAML. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh] That behavior is useful as a contract reference, but it is the wrong persistence model for an isolated CLI whose phase goal is local artifact preparation without mutating legacy paths. [VERIFIED: .planning/ROADMAP.md, standalone-cli/README.md] [ASSUMED]

The concrete contract to preserve is smaller than the shell wrappers: the generated config must still satisfy `src/config.ts`; the client token must still land under `auth.tokens`; OAuth data must still feed `initOAuth`; proxy settings must still reach `src/proxy-agent.ts`; and runtime readiness must still be proven through `/_health`. [VERIFIED: src/config.ts, src/auth.ts, src/oauth.ts, src/proxy-agent.ts, src/proxy.ts, config.example.yaml] The standalone CLI already has the prerequisite secret-safe credential discovery contract from Phase 6, so Phase 7 can build on that typed result instead of shell `eval` plus inline Python. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/credential-discovery/parse.ts, standalone-cli/tests/credential-discovery.test.ts, scripts/quick-setup.sh]

The safest implementation pattern is: keep durable bootstrap state in a CLI-owned manifest, generate legacy-compatible `config.yaml` from that state on every run, refresh only the OAuth fields that actually change, and only hand off to Phase 8 after the gateway runtime proves ready through `/_health`. [VERIFIED: src/index.ts, src/config.ts, src/proxy.ts, scripts/add-client.sh] [ASSUMED]

**Primary recommendation:** Use a CLI-owned workspace plus JSON manifest as the source of truth, render a legacy-compatible `config.yaml` from it, preserve proxy env by child-process inheritance, and treat `_health` success as the launch gate. [VERIFIED: src/index.ts, src/config.ts, src/proxy-agent.ts, src/proxy.ts] [ASSUMED]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `v22.19.0` locally, repo expects `22+`. [VERIFIED: local command] [VERIFIED: package.json, AGENTS.md] | Runtime for the standalone CLI and the existing TypeScript gateway. [VERIFIED: package.json, src/index.ts, standalone-cli/package.json] | Matches the existing repo contract and is already available in this workspace. [VERIFIED: local command, package.json] |
| TypeScript | Repo pins `^5.7.0`; npm registry latest is `5.9.2` and the registry reports a September 11, 2025 modification date. [VERIFIED: package.json] [VERIFIED: npm registry search] | Compile `standalone-cli/` and the existing TypeScript gateway. [VERIFIED: package.json, standalone-cli/package.json, standalone-cli/tsconfig.json] | Phase 7 should reuse the repo-pinned compiler instead of upgrading toolchains mid-milestone. [VERIFIED: package.json, standalone-cli/package.json] [ASSUMED] |
| `tsx` | Repo pins `^4.19.0`; npm registry latest is `4.20.5` and the registry reports a September 17, 2025 modification date. [VERIFIED: package.json] [VERIFIED: npm registry search] | Package-local tests and any dev-mode direct TS execution. [VERIFIED: package.json, standalone-cli/package.json] | The repo already uses direct `tsx` execution for tests and dev loops, so Phase 7 does not need a second test runner. [VERIFIED: package.json, standalone-cli/package.json] |
| Node stdlib (`crypto`, `fs/promises`, `path`, `os`, `child_process`, `http`) | Bundled with Node. [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/fs.html] | Generate tokens/identity, manage workspace files, spawn the runtime, and poll local health endpoints. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts, standalone-cli/src/credential-discovery/sources/keychain.ts, src/proxy.ts] | The required primitives already exist in the platform and in repo patterns; no new runtime dependency is necessary for the recommended Phase 7 design. [VERIFIED: repo files] [ASSUMED] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `yaml` | Repo dependency `^2.7.0`; npm registry latest is `2.8.1` with an August 18, 2025 modification date. [VERIFIED: package.json] [VERIFIED: npm registry search] | Safe read/write only if the standalone CLI must parse or preserve a CLI-owned YAML config instead of treating YAML as a generated artifact. [VERIFIED: src/config.ts, package.json] [ASSUMED] | Prefer manifest-to-rendered-config generation first; use `yaml` only if Phase 7 must merge with an existing CLI-owned config file. [VERIFIED: scripts/add-client.sh, src/config.ts] [ASSUMED] |
| `/usr/bin/security` | Available in this environment. [VERIFIED: local command] | Reuse the Phase 6 macOS Keychain discovery path when credentials are not already present in the CLI workspace. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts, scripts/quick-setup.sh, scripts/admin-setup.sh] | Use only on `darwin`, before file fallback, exactly as Phase 6 already does. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/credential-discovery/sources/keychain.ts] |
| `claude` binary | `2.1.92` locally. [VERIFIED: local command] | Downstream launch target and manual smoke prerequisite, not a Phase 7 blocker. [VERIFIED: scripts/add-client.sh, .planning/ROADMAP.md] | Keep this visible in the environment audit, but Phase 7 should not depend on `claude` execution to prove bootstrap/runtime preparation. [VERIFIED: .planning/ROADMAP.md] [ASSUMED] |
| `curl` | `8.7.1` locally. [VERIFIED: local command] | Manual operator smoke checks against `/_health`, matching legacy script behavior. [VERIFIED: scripts/add-client.sh, scripts/admin-setup.sh] | Treat `curl` as manual-only convenience; Phase 7 automation should use Node HTTP/fetch so the package does not depend on shell tools for readiness checks. [VERIFIED: scripts/add-client.sh, scripts/admin-setup.sh] [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CLI-owned workspace plus generated config. [ASSUMED] | Repo-root `config.yaml` and `clients/` artifacts like the legacy scripts. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh] | Rejected because the repo-root behavior is tied to legacy shell flows and breaks the isolated-package boundary this milestone depends on. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/README.md] |
| Manifest-driven re-render of generated files. [ASSUMED] | In-place YAML patching and token appends. [VERIFIED: scripts/add-client.sh] | Rejected because repeated appends are exactly the corruption/duplication risk named by `ENV-03`. [VERIFIED: .planning/REQUIREMENTS.md, scripts/add-client.sh] |
| `node dist/index.js <configPath>` after ensuring a build exists. [VERIFIED: package.json, src/index.ts] [ASSUMED] | `npx tsx src/index.ts <configPath>` every time. [VERIFIED: package.json] [ASSUMED] | Prefer the built JS entrypoint for repeatable operator runtime prep; reserve `tsx` execution for dev fallback or local debugging. [VERIFIED: package.json, standalone-cli/package.json] [ASSUMED] |
| Existing repo `yaml` dependency only when necessary. [VERIFIED: package.json] [ASSUMED] | Hand-rolled line-based YAML editing. [VERIFIED: scripts/add-client.sh] [ASSUMED] | Rejected because line-based edits are fragile, hard to keep idempotent, and easy to break when optional fields such as `canonical_profile_path` are present. [VERIFIED: src/config.ts, tests/config.test.ts] [ASSUMED] |

**Installation:** Reuse the existing repo toolchain; do not add new runtime dependencies for Phase 7. [VERIFIED: package.json, standalone-cli/package.json] [ASSUMED]

```bash
npm install
```

**Version verification:** `npm view` did not complete inside this sandboxed session, so current package freshness was cross-checked against npm registry search results rather than a live CLI registry query. [VERIFIED: local command behavior] [VERIFIED: npm registry search]

## Architecture Patterns

### Recommended Project Structure

```text
standalone-cli/
├── src/
│   ├── cli.ts
│   ├── output.ts
│   ├── credential-discovery/
│   └── environment/
│       ├── prepare.ts
│       ├── workspace.ts
│       ├── manifest.ts
│       ├── config-render.ts
│       ├── identity.ts
│       ├── tokens.ts
│       ├── proxy-env.ts
│       └── runtime.ts
└── tests/
    ├── environment-bootstrap.test.ts
    ├── proxy-env.test.ts
    ├── runtime-preparation.test.ts
    └── helpers/
```

This keeps all new logic inside `standalone-cli/`, leaves legacy codepaths untouched, and separates artifact generation from runtime orchestration. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/package.json, standalone-cli/README.md] [ASSUMED]

### Pattern 1: Use a CLI-Owned Manifest as the Durable Source of Truth

**What:** Persist the generated identity, client token, chosen gateway port, config path, and optional runtime metadata in a JSON manifest owned by the standalone CLI; re-render `config.yaml` from that state on every run. [ASSUMED]  
**When to use:** First-run bootstrap and every repeat run that needs to reuse or refresh artifacts. [VERIFIED: .planning/REQUIREMENTS.md]  
**Why:** The legacy scripts either short-circuit when `config.yaml` already exists or append new auth tokens directly into YAML; neither pattern gives the standalone CLI a safe, typed reuse model. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh]  
**Example:**  

```typescript
type BootstrapManifest = {
  workspaceDir: string
  configPath: string
  clientName: string
  clientToken: string
  identity: {
    deviceId: string
    accountUuid: string
    sessionId: string
  }
  runtime?: {
    port: number
    pid?: number
    configHash?: string
  }
}
```

Source basis: the legacy scripts generate these same categories of values, but only in shell variables and repo-root files. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh]

### Pattern 2: Generate Stable Identity and Client Auth Once, Refresh OAuth Separately

**What:** Generate `device_id` and client token once using Node crypto; reuse them on repeat runs; refresh only the OAuth block from newly discovered credentials. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts, standalone-cli/src/credential-discovery/discover.ts] [ASSUMED]  
**When to use:** Always, because `ENV-03` is about safe reruns, not regenerating every artifact on every invocation. [VERIFIED: .planning/REQUIREMENTS.md]  
**Why:** `src/config.ts` requires `oauth.refresh_token`, at least one `auth.tokens` entry, and a real 64-character `identity.device_id`, while `src/oauth.ts` treats `access_token` as optional and reusable when still valid. [VERIFIED: src/config.ts, src/oauth.ts]  
**Example:**  

```typescript
import { randomBytes } from 'crypto'

function createHexToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

function createBootstrapIdentity() {
  return {
    deviceId: createHexToken(32),
    accountUuid: `canonical-account-${createHexToken(8)}`,
    sessionId: `canonical-session-${createHexToken(8)}`,
  }
}
```

Source basis: the legacy TS helpers already use `randomBytes(...).toString('hex')`, and the shell scripts create the same account/session prefixes with random suffixes. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts, scripts/quick-setup.sh, scripts/admin-setup.sh]

### Pattern 3: Render a Legacy-Compatible Config Shape, But Keep It Outside Protected Paths

**What:** Generate a `config.yaml` that preserves the legacy top-level blocks: `server`, `upstream`, `oauth`, `auth`, `identity`, `env`, `prompt_env`, `process`, and `logging`. [VERIFIED: config.example.yaml, scripts/quick-setup.sh, scripts/admin-setup.sh, src/config.ts]  
**When to use:** On first run and on repeat runs after manifest or credential changes. [VERIFIED: .planning/REQUIREMENTS.md]  
**Why:** The runtime contract lives in `src/config.ts`; the standalone CLI should satisfy that contract without writing repo-root `config.yaml` or generating `clients/cc-*` launcher artifacts that belong to the old shell UX. [VERIFIED: src/config.ts, scripts/quick-setup.sh, scripts/add-client.sh, standalone-cli/README.md] [ASSUMED]  
**Example:**  

```yaml
server:
  port: 8443
upstream:
  url: https://api.anthropic.com
oauth:
  access_token: "...optional..."
  refresh_token: "...required..."
  expires_at: 0
auth:
  tokens:
    - name: local-operator
      token: "...client token..."
identity:
  device_id: "...64 hex chars..."
```

Source basis: this is the minimum legacy-compatible shape the current TypeScript runtime accepts and the legacy setup scripts generate. [VERIFIED: src/config.ts, config.example.yaml, scripts/quick-setup.sh, scripts/admin-setup.sh]

### Pattern 4: Runtime Preparation Must Be Health-Gated, Not Sleep-Gated

**What:** Build or reuse the gateway runtime, start it with the generated config path, and poll `/_health` until the runtime is actually ready. [VERIFIED: src/index.ts, package.json, src/proxy.ts] [ASSUMED]  
**When to use:** After artifact generation and before any future Claude launch handoff. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md]  
**Why:** `src/index.ts` loads config, initializes OAuth, and only then starts the proxy; `/_health` is unauthenticated and returns `200` only when a valid access token is available. [VERIFIED: src/index.ts, src/oauth.ts, src/proxy.ts]  
**Example:**  

```typescript
async function waitForHealth(baseUrl: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/_health`).catch(() => null)
    if (response?.ok) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Gateway runtime did not become healthy before launch handoff')
}
```

Source basis: `/_health` is the current reachability contract used by the legacy launcher/status flows. [VERIFIED: src/proxy.ts, scripts/add-client.sh, scripts/admin-setup.sh]

### Anti-Patterns to Avoid

- **Writing repo-root `config.yaml` or `clients/` artifacts from the standalone CLI:** That recreates the legacy shell side effects instead of an isolated Phase 7 workspace. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md]
- **Importing protected legacy runtime modules such as `src/config.ts` or `src/oauth.ts` directly into `standalone-cli/`:** That would couple the isolated package to protected implementation paths and weaken the milestone boundary. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md, standalone-cli/README.md] [ASSUMED]
- **Appending new auth tokens on every rerun:** `ENV-03` forbids duplication/corruption, and the legacy append strategy in `scripts/add-client.sh` is exactly the risk to avoid. [VERIFIED: .planning/REQUIREMENTS.md, scripts/add-client.sh]
- **Normalizing proxy env into a new custom config format:** The existing runtime only knows the standard proxy env variables at process start. [VERIFIED: src/proxy-agent.ts, src/oauth.ts]
- **Treating “child process started” as “runtime ready”:** The gateway is not ready until OAuth initialization completes and `/_health` succeeds. [VERIFIED: src/index.ts, src/oauth.ts, src/proxy.ts]
- **Printing discovered OAuth tokens or generated client tokens in help/status output:** The Phase 6 output surface already established secret-safe rendering; Phase 7 should preserve that bar. [VERIFIED: standalone-cli/src/output.ts, standalone-cli/tests/credential-discovery.test.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token and identity generation. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] | Shelling out to `openssl` from the new CLI or inventing a custom RNG. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh] [ASSUMED] | Node `crypto.randomBytes(...).toString('hex')`. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html] | The repo already has this TS pattern, and it keeps the standalone package self-contained. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] |
| YAML update logic. [VERIFIED: scripts/add-client.sh, src/config.ts] | Line-based appenders or brittle string replacements. [VERIFIED: scripts/add-client.sh] [ASSUMED] | Manifest-driven full render, or the existing `yaml` dependency only if merge/preserve behavior is required. [VERIFIED: package.json, src/config.ts] [ASSUMED] | Idempotent reruns are easier to prove when YAML is generated from typed state rather than mutated incrementally. [VERIFIED: .planning/REQUIREMENTS.md] [ASSUMED] |
| Runtime readiness detection. [VERIFIED: src/proxy.ts, scripts/add-client.sh] | Fixed sleeps like “wait 2 seconds and hope”. [ASSUMED] | Poll the existing unauthenticated `/_health` endpoint until it returns success. [VERIFIED: src/proxy.ts, scripts/add-client.sh, scripts/admin-setup.sh] | This matches the repo’s current operator contract and proves OAuth readiness, not just process existence. [VERIFIED: src/proxy.ts, src/index.ts, src/oauth.ts] |
| Proxy configuration. [VERIFIED: src/proxy-agent.ts] | A new standalone proxy config schema. [ASSUMED] | Inherit the existing `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` / `ALL_PROXY` / `all_proxy` env contract unchanged. [VERIFIED: src/proxy-agent.ts] | `ENV-04` is about preserving the existing contract, not creating a new one. [VERIFIED: .planning/REQUIREMENTS.md, src/proxy-agent.ts] |
| OAuth lifecycle in the standalone CLI. [VERIFIED: src/oauth.ts, .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md] | A second refresh scheduler inside `standalone-cli/`. [ASSUMED] | Reuse Phase 6 credential discovery and let the existing gateway runtime keep ownership of token refresh after startup. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, src/oauth.ts] | The legacy runtime already centralizes refresh timing, retry, and proxy-agent usage. [VERIFIED: src/oauth.ts, tests/oauth.test.ts] |

**Key insight:** Phase 7 becomes much easier to plan and verify if the standalone CLI owns durable bootstrap state explicitly and treats YAML plus the runtime process as generated outputs, not as the canonical source of truth. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh, src/config.ts, src/index.ts] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Recreating the Legacy Repo-Root Side Effects

**What goes wrong:** The new CLI writes `config.yaml` into the repo root or starts generating `clients/cc-*` shell launchers because that is what the old shell scripts do. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh]  
**Why it happens:** The shell scripts are the clearest artifact-generation reference, so it is easy to copy their file destinations along with their config shape. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh]  
**How to avoid:** Preserve the config contract, but move ownership of generated artifacts into a standalone CLI workspace and pass the config path explicitly to the runtime. [VERIFIED: src/index.ts, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md] [ASSUMED]  
**Warning signs:** A plan mentions repo-root `config.yaml`, `clients/`, or shell launcher generation in Phase 7. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh, .planning/ROADMAP.md]

### Pitfall 2: Rotating Client Auth on Every Run

**What goes wrong:** Every rerun creates a new client token or a second `auth.tokens` entry, so prepared environments drift and old launch context stops matching the runtime. [VERIFIED: .planning/REQUIREMENTS.md] [ASSUMED]  
**Why it happens:** The legacy add-client flow is designed for adding more clients, not for idempotent reuse of one local bootstrap identity. [VERIFIED: scripts/add-client.sh, README.md]  
**How to avoid:** Persist one local client token in the CLI-owned manifest and only rotate it through an explicit future command, not as a side effect of rerun. [ASSUMED]  
**Warning signs:** `auth.tokens` length grows across repeated local bootstrap runs or the manifest/config diff changes without operator intent. [ASSUMED]

### Pitfall 3: Losing Proxy Settings When Spawning the Runtime

**What goes wrong:** The standalone CLI discovers credentials and writes config successfully, but the gateway child process fails outbound refresh/API calls because the proxy env never reaches `src/proxy-agent.ts`. [VERIFIED: src/proxy-agent.ts, src/oauth.ts] [ASSUMED]  
**Why it happens:** The runtime resolves proxy env once at module load, so any child-process env filtering or renaming silently bypasses the existing contract. [VERIFIED: src/proxy-agent.ts]  
**How to avoid:** Spawn the runtime with inherited environment variables and test the precedence/order contract directly. [VERIFIED: src/proxy-agent.ts] [ASSUMED]  
**Warning signs:** A plan introduces custom proxy config fields or drops lowercase/uppercase variants from the child env. [VERIFIED: src/proxy-agent.ts] [ASSUMED]

### Pitfall 4: Declaring Runtime Ready Before OAuth Is Ready

**What goes wrong:** The CLI launches or prepares handoff before the gateway has a valid access token, so the first Claude request hits a `503` or a misleading “half-bootstrapped” environment. [VERIFIED: src/proxy.ts, .planning/research/PITFALLS.md]  
**Why it happens:** Process spawn success is easier to observe than actual readiness, and the shell launcher only warns when health is unreachable. [VERIFIED: scripts/add-client.sh, src/proxy.ts]  
**How to avoid:** Make Phase 7 health-gated and fail the prepare step if `/_health` does not become ready in time. [VERIFIED: src/proxy.ts, .planning/REQUIREMENTS.md] [ASSUMED]  
**Warning signs:** A plan uses fixed sleeps, skips `/_health`, or treats `503 degraded` as good enough for handoff. [VERIFIED: src/proxy.ts] [ASSUMED]

### Pitfall 5: Overwriting Advanced Config Semantics During Reuse

**What goes wrong:** A rerun blows away optional fields such as `canonical_profile_path` or invalidates relative profile paths by moving the config unexpectedly. [VERIFIED: src/config.ts, tests/config.test.ts] [ASSUMED]  
**Why it happens:** The legacy shell templates write a full inline config and do not reason about preserving operator-edited advanced settings. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh]  
**How to avoid:** Either keep advanced config fully CLI-owned and generated from manifest, or explicitly preserve supported optional fields such as `canonical_profile_path` during rerender. [VERIFIED: src/config.ts, tests/config.test.ts] [ASSUMED]  
**Warning signs:** Existing CLI-owned config contains `canonical_profile_path`, but the rerendered file drops it or breaks its relative path resolution. [VERIFIED: tests/config.test.ts]

## Code Examples

Verified patterns from repo and official sources:

### Stable Token Generation

```typescript
import { randomBytes } from 'crypto'

const clientToken = randomBytes(32).toString('hex')
const deviceId = randomBytes(32).toString('hex')
```

Source: `src/scripts/generate-token.ts`, `src/scripts/generate-identity.ts`, and Node.js crypto docs. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html]

### Proxy Precedence Contract

```typescript
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.ALL_PROXY ||
  process.env.all_proxy
```

Source: `src/proxy-agent.ts`. [VERIFIED: src/proxy-agent.ts]

### Keychain Adapter Pattern

```typescript
const { stdout } = await execFileText('/usr/bin/security', [
  'find-generic-password',
  '-a',
  user,
  '-s',
  'Claude Code-credentials',
  '-w',
])
```

Source: `standalone-cli/src/credential-discovery/sources/keychain.ts` and Node.js child-process docs. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]

### Runtime Readiness Contract

```typescript
if (path === '/_health') {
  const oauthOk = !!getAccessToken()
  const status = oauthOk ? 200 : 503
}
```

Source: `src/proxy.ts`. [VERIFIED: src/proxy.ts]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Repo-root shell setup writes `config.yaml`, creates launcher files, and starts the gateway immediately. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh] | The milestone now uses an isolated `standalone-cli/` package and reserves config generation, runtime preparation, and launch as explicit later phases. [VERIFIED: standalone-cli/README.md, .planning/ROADMAP.md] | Phase split established on 2026-04-08. [VERIFIED: .planning/ROADMAP.md, .planning/STATE.md] | Phase 7 should build bootstrap/runtime logic in the isolated package instead of extending the shell scripts. [VERIFIED: standalone-cli/README.md, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md] |
| README narrative says OAuth refresh happens 5 minutes before expiry. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md] | The code and tests show the runtime reuses valid access tokens until actual expiry and refreshes at expiry. [VERIFIED: src/oauth.ts, tests/oauth.test.ts] | Drift documented in Phase 05 on 2026-04-08. [VERIFIED: .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md] | Runtime readiness planning should trust code/tests, not the stale README wording. [VERIFIED: src/oauth.ts, tests/oauth.test.ts] |
| Phase 6 handled only additive help and credential discovery. [VERIFIED: standalone-cli/README.md, .planning/phases/06-standalone-cli-scaffold-credential-discovery/VERIFICATION.md] | Phase 7 is the first phase that should own durable workspace artifacts and runtime preparation inside `standalone-cli/`. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md] | 2026-04-08 roadmap state. [VERIFIED: .planning/STATE.md, .planning/ROADMAP.md] | The planner should avoid redoing Phase 6 scaffolding and instead extend the existing typed discovery surface. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/cli.ts] |

**Deprecated/outdated:**

- Treating the repo-root shell script destinations as the target artifact layout for the new CLI is outdated for this milestone. [VERIFIED: standalone-cli/README.md, .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md]
- Treating README OAuth timing text as the live runtime contract is outdated; the code/tests are authoritative. [VERIFIED: src/oauth.ts, tests/oauth.test.ts, .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The standalone CLI should own a dedicated local workspace path instead of writing repo-root `config.yaml` and `clients/` artifacts. [ASSUMED] | Summary, Architecture Patterns | Medium: if the user wants repo-root artifact reuse, the plan would need a different persistence model. |
| A2 | A JSON manifest should be the durable source of truth and `config.yaml` should be rendered from it instead of incrementally patched. [ASSUMED] | Summary, Architecture Patterns, Don't Hand-Roll | Medium: Phase 7 could still work with YAML parsing, but idempotency and verification would become harder. |
| A3 | Runtime preparation should prefer `node dist/index.js <configPath>` after ensuring a build exists, with `tsx` only as dev fallback. [ASSUMED] | Standard Stack, Architecture Patterns, Open Questions | Low: the planner can switch to a different spawn target if operator ergonomics or packaging constraints differ. |

**If this table is empty:** not applicable; this research contains design recommendations that are not fully locked by phase context. [ASSUMED]

## Open Questions (RESOLVED)

1. **What exact persistent workspace path should the standalone CLI own?**
   - What we know: the repo already persists local desktop state under `~/.ccgw/`, while the new CLI must not reuse repo-root shell artifact paths. [VERIFIED: AGENTS.md, scripts/quick-setup.sh, scripts/add-client.sh, crates/desktop/src-tauri/src/daemon.rs]
   - Resolution: default the standalone CLI workspace to a CLI-owned subdirectory under the existing `~/.ccgw/` namespace so it stays aligned with the project’s current local operator footprint, while keeping the path encapsulated inside the standalone package and not in repo-root artifacts. [VERIFIED: AGENTS.md, crates/desktop/src-tauri/src/daemon.rs] [ASSUMED]

2. **Should Phase 7 reuse an already healthy runtime or always restart it after config regeneration?**
   - What we know: Phase 7 must prepare runtime state before launch, and `/_health` is the current ready/not-ready contract. [VERIFIED: .planning/REQUIREMENTS.md, src/proxy.ts]
   - Resolution: reuse the runtime only when `/_health` is green and the stored runtime metadata matches the current manifest/config hash; otherwise restart to keep the prepare step deterministic without forcing unnecessary restarts. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Standalone CLI runtime and existing TS gateway runtime. [VERIFIED: package.json, standalone-cli/package.json, src/index.ts] | ✓ [VERIFIED: local command] | `v22.19.0` [VERIFIED: local command] | — |
| npm / npx | Build and package-local verification. [VERIFIED: package.json, standalone-cli/package.json] | ✓ [VERIFIED: local command] | `10.9.3` / `10.9.3` [VERIFIED: local command] | — |
| `/usr/bin/security` | macOS credential reuse path inherited from Phase 6. [VERIFIED: standalone-cli/src/credential-discovery/sources/keychain.ts] | ✓ [VERIFIED: local command] | available [VERIFIED: local command] | Credentials-file fallback already exists. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/credential-discovery/sources/credentials-file.ts] |
| `curl` | Manual health smoke flows from legacy scripts. [VERIFIED: scripts/add-client.sh, scripts/admin-setup.sh] | ✓ [VERIFIED: local command] | `8.7.1` [VERIFIED: local command] | Use Node HTTP/fetch inside the standalone CLI. [ASSUMED] |
| `claude` | Later Phase 8 launch target and optional manual prerequisite smoke. [VERIFIED: .planning/ROADMAP.md, scripts/add-client.sh] | ✓ [VERIFIED: local command] | `2.1.92` [VERIFIED: local command] | Phase 7 itself should not depend on launching it. [VERIFIED: .planning/ROADMAP.md] [ASSUMED] |
| Docker | Legacy admin script deployment path only. [VERIFIED: scripts/admin-setup.sh] | ✗ [VERIFIED: local command] | — | Use the Node runtime path; Docker is not required for this local phase. [VERIFIED: scripts/admin-setup.sh, .planning/ROADMAP.md] |

**Missing dependencies with no fallback:**

- None for the recommended local Phase 7 path in this environment. [VERIFIED: local command, package.json, standalone-cli/package.json]

**Missing dependencies with fallback:**

- Docker is unavailable locally, but the recommended Phase 7 runtime-prep path should use the existing Node gateway runtime instead of the remote/admin deployment flow. [VERIFIED: local command, scripts/admin-setup.sh, .planning/ROADMAP.md]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Direct `tsx` test scripts plus `tsc` build verification. [VERIFIED: package.json, standalone-cli/package.json] |
| Config file | none in `standalone-cli/`; package uses `tsconfig.json` plus direct `tsx` invocation. [VERIFIED: standalone-cli/package.json, standalone-cli/tsconfig.json] |
| Quick run command | `npx tsx standalone-cli/tests/credential-discovery.test.ts` today; add targeted Phase 7 test files for incremental work. [VERIFIED: standalone-cli/package.json, standalone-cli/tests/credential-discovery.test.ts] [ASSUMED] |
| Full suite command | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts`. [VERIFIED: existing commands in standalone-cli/package.json] [ASSUMED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENV-02 | First run creates or reuses a CLI-owned workspace plus legacy-compatible config with stable identity/client token and discovered OAuth values. [VERIFIED: .planning/REQUIREMENTS.md, src/config.ts, scripts/quick-setup.sh] | integration | `npx tsx standalone-cli/tests/environment-bootstrap.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: standalone-cli/tests/] |
| ENV-03 | Repeat run reuses stable bootstrap artifacts and does not append duplicate tokens or corrupt config state. [VERIFIED: .planning/REQUIREMENTS.md] | integration | `npx tsx standalone-cli/tests/environment-bootstrap.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: standalone-cli/tests/] |
| ENV-04 | Proxy env precedence is preserved when preparing/spawning the runtime. [VERIFIED: .planning/REQUIREMENTS.md, src/proxy-agent.ts] | unit | `npx tsx standalone-cli/tests/proxy-env.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: standalone-cli/tests/] |
| ENV-05 | Runtime preparation builds/reuses the runtime, starts it with the generated config path, and waits for successful `/_health` before handoff. [VERIFIED: .planning/REQUIREMENTS.md, src/index.ts, src/proxy.ts] | integration | `npx tsx standalone-cli/tests/runtime-preparation.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: standalone-cli/tests/] |

### Sampling Rate

- **Per task commit:** run the targeted new Phase 7 test file plus `npm --prefix standalone-cli run build`. [VERIFIED: standalone-cli/package.json] [ASSUMED]
- **Per wave merge:** run the standalone CLI full suite listed above. [VERIFIED: standalone-cli/package.json] [ASSUMED]
- **Phase gate:** full standalone CLI suite green, plus at least one manual local runtime smoke proving `_health` turns green with generated config. [VERIFIED: src/proxy.ts, scripts/add-client.sh] [ASSUMED]

### Wave 0 Gaps

- [ ] `standalone-cli/tests/environment-bootstrap.test.ts` — covers first-run generation and repeat-run idempotency for `ENV-02` and `ENV-03`. [VERIFIED: .planning/REQUIREMENTS.md, standalone-cli/tests/]
- [ ] `standalone-cli/tests/proxy-env.test.ts` — covers proxy env inheritance and precedence preservation for `ENV-04`. [VERIFIED: src/proxy-agent.ts, standalone-cli/tests/]
- [ ] `standalone-cli/tests/runtime-preparation.test.ts` — covers build/reuse path selection, process spawn, and health-gated readiness for `ENV-05`. [VERIFIED: package.json, src/index.ts, src/proxy.ts, standalone-cli/tests/]
- [ ] `standalone-cli/tests/helpers/temp-workspace.ts` or equivalent — shared temp-dir fixtures for safe manifest/config/runtime tests. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes [VERIFIED: src/auth.ts, config.example.yaml] | Generate one strong client token, store it only in CLI-owned bootstrap state/config, and never print it raw in normal output. [VERIFIED: src/auth.ts, config.example.yaml, standalone-cli/src/output.ts] [ASSUMED] |
| V3 Session Management | no [ASSUMED] | No user session surface is introduced by the standalone CLI itself; runtime readiness is health-based, not session-cookie-based. [VERIFIED: standalone-cli/src/cli.ts, src/proxy.ts] [ASSUMED] |
| V4 Access Control | yes [VERIFIED: src/auth.ts, src/proxy.ts] | Preserve the `auth.tokens` gateway contract and avoid duplicate or unintended token entries during reruns. [VERIFIED: src/auth.ts, scripts/add-client.sh, .planning/REQUIREMENTS.md] [ASSUMED] |
| V5 Input Validation | yes [VERIFIED: standalone-cli/src/credential-discovery/parse.ts, src/config.ts] | Validate discovered credential payloads, generated manifest/config state, optional profile paths, and health responses before reuse. [VERIFIED: standalone-cli/src/credential-discovery/parse.ts, src/config.ts, tests/config.test.ts, src/proxy.ts] |
| V6 Cryptography | yes [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] | Use Node crypto randomness for token/identity generation; never hand-roll entropy or weak deterministic token material. [VERIFIED: src/scripts/generate-token.ts, src/scripts/generate-identity.ts] [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html] |

### Known Threat Patterns for Local Bootstrap + Runtime Prep

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Raw OAuth or client-token leakage in stdout, logs, or checked-in files. [VERIFIED: .planning/PROJECT.md, standalone-cli/src/output.ts] | Information Disclosure | Keep output secret-safe, do not log raw tokens, and keep generated state in a user-scoped workspace rather than repo files. [VERIFIED: standalone-cli/src/output.ts, standalone-cli/tests/credential-discovery.test.ts] [ASSUMED] |
| Config corruption or duplicated auth state on repeat run. [VERIFIED: .planning/REQUIREMENTS.md, scripts/add-client.sh] | Tampering | Use one manifest source of truth and deterministic full-file render instead of incremental token appends. [VERIFIED: scripts/add-client.sh] [ASSUMED] |
| Proxy bypass because child runtime env drops standard proxy variables. [VERIFIED: src/proxy-agent.ts] | Information Disclosure | Inherit child env unchanged and add explicit tests for precedence/order preservation. [VERIFIED: src/proxy-agent.ts] [ASSUMED] |
| Launch handoff to a process that is running but not actually ready. [VERIFIED: src/index.ts, src/proxy.ts, .planning/research/PITFALLS.md] | Denial of Service | Gate readiness on successful `/_health` before any future launch handoff. [VERIFIED: src/proxy.ts, scripts/add-client.sh] [ASSUMED] |
| Overwriting arbitrary paths if workspace/config destinations are not normalized. [ASSUMED] | Tampering / Elevation of Privilege | Resolve absolute paths inside a CLI-owned workspace and reject writes outside it. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Local repo files:
  - `src/config.ts` - config contract, `canonical_profile_path`, required auth/oauth/identity fields. [VERIFIED: src/config.ts]
  - `src/index.ts` - startup sequence (`loadConfig` → `initOAuth` → `startProxy`). [VERIFIED: src/index.ts]
  - `src/oauth.ts` and `tests/oauth.test.ts` - OAuth reuse/refresh behavior and readiness implications. [VERIFIED: src/oauth.ts, tests/oauth.test.ts]
  - `src/proxy-agent.ts` - proxy env precedence contract. [VERIFIED: src/proxy-agent.ts]
  - `src/proxy.ts` - `/_health` and `/_verify` runtime contracts. [VERIFIED: src/proxy.ts]
  - `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, `scripts/add-client.sh`, `scripts/extract-token.sh` - legacy bootstrap, runtime, and launcher semantics. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/add-client.sh, scripts/extract-token.sh]
  - `config.example.yaml` and `tests/config.test.ts` - legacy-compatible config shape and edge cases. [VERIFIED: config.example.yaml, tests/config.test.ts]
  - `standalone-cli/src/credential-discovery/*`, `standalone-cli/src/output.ts`, `standalone-cli/tests/*` - current isolated package surface and existing verification. [VERIFIED: standalone-cli/src/credential-discovery/discover.ts, standalone-cli/src/credential-discovery/parse.ts, standalone-cli/src/output.ts, standalone-cli/tests/credential-discovery.test.ts, standalone-cli/tests/cli-help.test.ts]
- Local environment commands:
  - `node --version`, `npm --version`, `npx --version`, `python3 --version`, `openssl version`, `claude --version`, `command -v security`, `curl --version`, `docker info`. [VERIFIED: local command]
- Official docs:
  - Node.js crypto docs: `https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html` [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/crypto.html]
  - Node.js child_process docs: `https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html` [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/child_process.html]
  - Node.js fs docs: `https://nodejs.org/download/release/v22.19.0/docs/api/fs.html` [CITED: https://nodejs.org/download/release/v22.19.0/docs/api/fs.html]

### Secondary (MEDIUM confidence)

- npm registry search results for current package versions and modification dates:
  - TypeScript `5.9.2`
  - `tsx` `4.20.5`
  - `yaml` `2.8.1`
  - `@types/node` `24.3.1`  
  [VERIFIED: npm registry search]

### Tertiary (LOW confidence)

- None. [VERIFIED: no low-confidence sources used in this file]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - current package/runtime availability is verified locally and the repo toolchain is explicit. [VERIFIED: local command, package.json, standalone-cli/package.json]
- Architecture: MEDIUM - the legacy runtime/artifact contracts are clear, but the exact standalone workspace/manifest shape is still a design choice for the planner. [VERIFIED: repo files] [ASSUMED]
- Pitfalls: HIGH - they follow directly from the shell-script behavior, phase requirements, and the existing runtime readiness contract. [VERIFIED: scripts/quick-setup.sh, scripts/add-client.sh, src/proxy.ts, .planning/research/PITFALLS.md]

**Research date:** 2026-04-08 [VERIFIED: repo files]  
**Valid until:** 2026-05-08 for repo-local contracts; re-check npm/package freshness sooner if the toolchain is upgraded. [VERIFIED: repo files] [ASSUMED]
