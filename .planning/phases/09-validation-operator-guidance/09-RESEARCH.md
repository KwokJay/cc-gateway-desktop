# Phase 9: Validation & Operator Guidance - Research

**Researched:** 2026-04-08
**Domain:** Standalone CLI validation surface, contract testing, and operator guidance
**Confidence:** HIGH

<user_constraints>
## User Constraints

- This phase should not add new product behavior unless a small documentation-aligned fix is necessary. [VERIFIED: user prompt]
- This phase should close the gap between what the package-local tests and docs prove today and what operators and reviewers need as durable project guidance. [VERIFIED: user prompt]
- Treat current verifier artifacts and the stale `docs/standalone-cli.md` as first-class inputs. [VERIFIED: user prompt]
- Keep all new work consistent with the isolated `standalone-cli/` package and protected legacy path boundary. [VERIFIED: user prompt]
- Phase 9 depends on Phases 7 and 8 and must address `QLT-01` and `QLT-02`. [VERIFIED: user prompt] [VERIFIED: repo files]

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QLT-01 | Automated tests cover capability inventory classification, credential detection decisions, bootstrap artifact generation, and Claude launch environment preparation without requiring live OAuth traffic. [VERIFIED: repo files] | Reuse the existing direct `tsx` + dependency-injection test style, add a package-local capability-inventory contract test, and keep all behavior proof fixture-driven instead of depending on live OAuth or a real `claude` subprocess. [VERIFIED: repo files] [VERIFIED: local commands] |
| QLT-02 | Checked-in operator guidance covers first-run bootstrap, repeat-run behavior, and recovery paths for missing credentials or missing `claude`. [VERIFIED: repo files] | Make `standalone-cli/README.md` the canonical operator guide, reduce `docs/standalone-cli.md` to an aligned summary or pointer, and add a package-local docs contract test that enforces the required scenarios and current paths/commands. [VERIFIED: repo files] |

</phase_requirements>

## Summary

The current standalone CLI already has a strong package-local proof surface for credential discovery, bootstrap generation, proxy environment inheritance, runtime preparation, and Claude handoff. `npm --prefix standalone-cli run build` and all six current standalone package tests passed locally on 2026-04-08, and those tests use fixtures plus dependency injection rather than live OAuth traffic. [VERIFIED: repo files] [VERIFIED: local commands]

The remaining Phase 9 gaps are narrow and specific. There is no automated test that enforces the Phase 05 capability inventory classification contract, there is no aggregate `npm --prefix standalone-cli test` script because that command currently fails with `Missing script: "test"`, and the repo-level operator doc is stale: `docs/standalone-cli.md` still describes `src/standalone-cli/`, `~/.ccg-local-cli/*`, `setup` and `status` commands, and in-process gateway startup, while the live package is top-level `standalone-cli/` with `discover-credentials`, `prepare-runtime`, `~/.ccgw/standalone-cli/{manifest.json,config.yaml,runtime.json}`, and direct `claude` handoff. [VERIFIED: repo files] [VERIFIED: local commands]

**Primary recommendation:** Keep the existing direct `tsx` + `assert` testing style, add two package-local contract tests (`capability-inventory` and operator-guidance docs), add one aggregate package-local test command for reviewers, and collapse documentation ownership to one canonical operator guide in `standalone-cli/README.md` with `docs/standalone-cli.md` reduced to a synced overview or pointer. [VERIFIED: repo files]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `v22.19.0` locally available; repo stack expects Node `22+`. [VERIFIED: local commands] [VERIFIED: repo files] | Runtime for `tsx`, `tsc`, and the standalone CLI build/test commands. [VERIFIED: repo files] | The root repo and standalone package already build and test successfully on the installed Node runtime. [VERIFIED: local commands] |
| TypeScript | `5.9.3` installed locally; root repo declares `^5.7.0`. [VERIFIED: local commands] [VERIFIED: repo files] | Compile guard for `standalone-cli/src/**` through `tsc -p tsconfig.json`. [VERIFIED: repo files] | Phase 9 should preserve the current compile-first validation flow instead of adding a new transpile path. [VERIFIED: repo files] |
| `tsx` | `4.21.0` installed locally; root repo declares `^4.19.0`. [VERIFIED: local commands] [VERIFIED: repo files] | Direct execution of package-local tests without a separate test framework config. [VERIFIED: repo files] | Every existing standalone CLI and root TypeScript test already uses direct `tsx` entrypoints. [VERIFIED: repo files] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node built-ins (`assert`, `fs`, `fs/promises`, `path`) | Built into the active Node runtime. [VERIFIED: local commands] | Contract tests for markdown artifacts, workspace files, and CLI output capture. [VERIFIED: repo files] | Use for Phase 9 contract tests instead of introducing Vitest/Jest or a markdown parser dependency. [VERIFIED: repo files] |
| `yaml` | `2.8.3` installed locally; root repo declares `^2.7.0`. [VERIFIED: local commands] [VERIFIED: repo files] | Existing bootstrap tests parse generated `config.yaml` to prove rendered artifacts. [VERIFIED: repo files] | Keep using it only where config shape must be asserted; Phase 9 docs tests should not need additional parsing dependencies. [VERIFIED: repo files] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `tsx` test files in `standalone-cli/tests/*.test.ts` [VERIFIED: repo files] | Vitest or Jest | Rejected because the current package already uses direct `tsx` scripts successfully, has no framework config, and Phase 9 does not need new dependencies or runner semantics. [VERIFIED: repo files] [VERIFIED: local commands] |
| `standalone-cli/README.md` as the canonical operator guide [VERIFIED: repo files] | `docs/standalone-cli.md` as the canonical guide | Rejected because the repo-level doc is already stale while the package README matches the live commands and package boundary. [VERIFIED: repo files] |
| Simple string/regex contract checks over markdown files [VERIFIED: repo files] | Markdown AST parsing dependency | Rejected because the required contracts are stable headings, commands, paths, and recovery wording; extra parsing machinery adds cost without improving Phase 9 confidence materially. [VERIFIED: repo files] |

**Installation:**
```bash
# No new package installs are recommended for Phase 9.
npm install
```

**Version verification:** Local verification on 2026-04-08 found `node v22.19.0`, `npm 10.9.3`, `npx 10.9.3`, `tsx 4.21.0`, `typescript 5.9.3`, and `yaml 2.8.3`. [VERIFIED: local commands]

## Architecture Patterns

### Recommended Project Structure

```text
standalone-cli/
├── README.md                       # canonical operator guide
├── package.json                    # aggregate build/test scripts
├── src/                            # unchanged runtime/product code unless a docs-aligned fix is necessary
└── tests/
    ├── capability-inventory.test.ts # Phase 05 classification contract
    ├── operator-guidance.test.ts    # README/docs contract
    └── existing *.test.ts           # credential/bootstrap/runtime/launch proof

docs/
└── standalone-cli.md               # thin repo-level overview or pointer to the package guide

.planning/phases/05-ts-backend-capability-inventory/
└── 05-CAPABILITY-INVENTORY.md      # canonical inventory artifact enforced by tests
```

This structure preserves the isolated `standalone-cli/` package boundary while letting Phase 9 validate planning artifacts and operator docs without touching protected legacy runtime paths. [VERIFIED: repo files]

### Pattern 1: Contract-Test the Capability Inventory

**What:** Add a package-local test that reads `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md` and asserts the presence of `## Capability Matrix`, the required classification vocabulary (`must-port`, `reference-only`, `deferred`), the `Known Drift` section, and the capability rows that still matter to Phase 9 such as config loading, client auth, proxy env, health/verify, credential extraction, config generation, launcher generation, and Claude handoff. [VERIFIED: repo files]

**When to use:** Use this for `QLT-01`, because no current standalone CLI test touches the Phase 05 inventory artifact even though the roadmap and requirements say Phase 9 must prove capability inventory classification. [VERIFIED: repo files]

**Example:**
```ts
function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/credential-discovery/${name}`, import.meta.url), 'utf8')
}
```
Source: `standalone-cli/tests/credential-discovery.test.ts`. [VERIFIED: repo files]

Phase 9 should reuse this same `readFileSync(new URL(...), import.meta.url)` pattern for markdown artifact reads rather than inventing a different file-loading strategy. [VERIFIED: repo files]

### Pattern 2: Keep CLI Proof Adapter-Driven

**What:** Continue testing `runCli(...)` and the launch/runtime helpers by injecting `discoverCredentials`, `prepareRuntimeEnvironment`, `readBootstrapManifest`, and `launchClaude` dependencies. [VERIFIED: repo files]

**When to use:** Use this for all first-run, repeat-run, missing-credential, and missing-`claude` scenarios so Phase 9 stays deterministic and does not require live OAuth traffic, Keychain access, or a real Claude subprocess. [VERIFIED: repo files] [VERIFIED: local commands]

**Example:**
```ts
const result = await captureRun(passthroughArgs, {
  discoverCredentials: async () => ({
    ok: true,
    source: 'credentials-file',
    credentials: fixtureCredentials(),
  }),
  prepareRuntimeEnvironment: async () => preparedRuntime,
  readBootstrapManifest: async () => manifest,
  launchClaude: async (input: unknown) => {
    launchCalls.push(input)
    return 0
  },
})
```
Source: `standalone-cli/tests/claude-launch.test.ts`. [VERIFIED: repo files]

### Pattern 3: One Canonical Operator Guide, One Pointer

**What:** Put the full operator story in `standalone-cli/README.md`: first-run bootstrap, repeat-run behavior, workspace artifacts, `discover-credentials`, `prepare-runtime`, bare invocation, and recovery steps for missing credentials or missing `claude`. Keep `docs/standalone-cli.md` as a thin synced overview or direct pointer to the package README instead of maintaining a second detailed handbook. [VERIFIED: repo files]

**When to use:** Use this whenever a phase needs durable operator guidance, because the current duplicated-doc arrangement has already drifted. [VERIFIED: repo files]

**Example:**
```ts
assert.equal(secondManifest.client.token, firstManifest.client.token)
assert.equal(secondManifest.identity.deviceId, firstManifest.identity.deviceId)
assert.equal(config.oauth.refresh_token, 'rt-ant-bootstrap-refresh-UPDATED')
```
Source: `standalone-cli/tests/environment-bootstrap.test.ts`. [VERIFIED: repo files]

This is the behavior the docs must explain plainly: repeat runs keep stable client identity and token state while refreshing OAuth values and re-rendering config. [VERIFIED: repo files]

### Anti-Patterns to Avoid

- **Adding a live OAuth or real-`claude` automated gate:** The existing suite already proves core CLI behavior without network or live process dependencies, and the phase success criteria explicitly say not to require live OAuth traffic. [VERIFIED: repo files] [VERIFIED: local commands]
- **Maintaining two independent detailed operator guides:** `docs/standalone-cli.md` is already stale while `standalone-cli/README.md` matches the live package surface. [VERIFIED: repo files]
- **Introducing a new test framework for doc assertions:** The repo already uses direct `tsx` scripts and Node assertions successfully. [VERIFIED: repo files] [VERIFIED: local commands]
- **Editing protected legacy paths to satisfy Phase 9:** The roadmap, project constraints, and phase prompt all say this phase should stay within the isolated standalone package boundary unless a minimal docs-aligned fix is unavoidable. [VERIFIED: user prompt] [VERIFIED: repo files]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Automated proof for missing credentials, repeat runs, and missing `claude` [VERIFIED: repo files] | A live end-to-end harness that depends on a real Claude login, real Keychain data, or a real external `claude` launch [VERIFIED: repo files] | The existing adapter-driven `runCli`, `prepareRuntimeEnvironment`, and `launchClaude` tests plus new contract tests [VERIFIED: repo files] | This keeps Phase 9 deterministic and satisfies the “no live OAuth traffic” success criterion. [VERIFIED: repo files] |
| Capability inventory validation [VERIFIED: repo files] | A new parser framework or copied inventory fixture [VERIFIED: repo files] | A direct file-read contract test over `05-CAPABILITY-INVENTORY.md` [VERIFIED: repo files] | The artifact is already a stable markdown table, and QLT-01 only requires proving the checked-in classification contract. [VERIFIED: repo files] |
| Operator guidance maintenance [VERIFIED: repo files] | Two separate long-form docs that must be manually kept in sync [VERIFIED: repo files] | One canonical package README plus a repo-level pointer or summary [VERIFIED: repo files] | The current stale `docs/standalone-cli.md` is evidence that duplicated authoritative docs drift quickly. [VERIFIED: repo files] |

**Key insight:** Phase 9 should add enforcement around the artifacts that already exist, not invent a broader runtime or documentation subsystem. [VERIFIED: repo files]

## Common Pitfalls

### Pitfall 1: Treating the Current Standalone Suite as “Done”

**What goes wrong:** Reviewers see passing standalone package tests and assume `QLT-01` is complete. [VERIFIED: repo files]  
**Why it happens:** The current suite covers help, credentials, bootstrap, proxy env, runtime preparation, and launch, but nothing verifies the Phase 05 capability inventory classification contract, and there is no aggregate `npm --prefix standalone-cli test` command today. [VERIFIED: repo files] [VERIFIED: local commands]  
**How to avoid:** Add a capability-inventory contract test and a single aggregate test script that reviewers can run without memorizing six-plus commands. [VERIFIED: repo files]  
**Warning signs:** `npm --prefix standalone-cli test` fails, or Phase 9 verification still relies on prose-only statements about the inventory. [VERIFIED: local commands] [VERIFIED: repo files]

### Pitfall 2: Refreshing the Package README but Leaving the Repo Doc Stale

**What goes wrong:** Operators discover `docs/standalone-cli.md` first and follow obsolete instructions. [VERIFIED: repo files]  
**Why it happens:** The repo-level doc still references `src/standalone-cli/`, `~/.ccg-local-cli/*`, `setup`, `status`, and in-process gateway startup, none of which match the live standalone package. [VERIFIED: repo files]  
**How to avoid:** Make `standalone-cli/README.md` canonical and reduce `docs/standalone-cli.md` to a thin synced overview or pointer. [VERIFIED: repo files]  
**Warning signs:** Any checked-in doc still mentions `src/standalone-cli`, `~/.ccg-local-cli`, or `setup`/`status` commands. [VERIFIED: repo files]

### Pitfall 3: Letting Phase 9 Depend on Machine-Specific Credentials or Binaries

**What goes wrong:** Automated validation becomes flaky, unreproducible, or blocked on an operator machine state. [VERIFIED: repo files]  
**Why it happens:** Credential discovery and launch behavior are easy to over-test with real Keychain data or a real installed `claude` binary instead of using the current injected adapters and fixtures. [VERIFIED: repo files]  
**How to avoid:** Keep automated proof at the fixture and dependency-injection layer; reserve real Keychain or real `claude` checks for optional manual smoke only. [VERIFIED: repo files] [VERIFIED: local commands]  
**Warning signs:** A proposed test command requires a browser login, network access, or a real operator credential file to pass. [VERIFIED: repo files]

### Pitfall 4: Accidentally Leaking Secrets in Docs or Tests

**What goes wrong:** Validation artifacts expose access tokens, refresh tokens, or bootstrap state values that should stay hidden. [VERIFIED: repo files]  
**Why it happens:** Phase 9 is docs-heavy and touches credential/bootstrap flows, so examples and failure messages can easily drift into concrete secret material if they are copied from a live machine. [VERIFIED: repo files]  
**How to avoid:** Keep using fixtures, hidden-token output patterns, and location-only guidance; never include raw token values in README or docs examples. [VERIFIED: repo files]  
**Warning signs:** Any doc or test output contains `sk-`, `rt-`, or a literal client token instead of “detected but hidden” style wording. [VERIFIED: repo files]

## Code Examples

Verified patterns from the current repo:

### File-Based Contract Reads
```ts
function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/credential-discovery/${name}`, import.meta.url), 'utf8')
}
```
Source: `standalone-cli/tests/credential-discovery.test.ts`. [VERIFIED: repo files]

### Injected CLI Branch Testing
```ts
const result = await captureRun([], {
  discoverCredentials: async () => ({
    ok: true,
    source: 'credentials-file',
    credentials: fixtureCredentials(),
  }),
  prepareRuntimeEnvironment: async () => preparedRuntime,
  readBootstrapManifest: async () => manifest,
  launchClaude: async (input: unknown) => {
    launchCalls.push(input)
    return 0
  },
})
```
Source: `standalone-cli/tests/claude-launch.test.ts`. [VERIFIED: repo files]

### Repeat-Run Bootstrap Guarantees
```ts
assert.equal(secondManifest.client.token, firstManifest.client.token)
assert.equal(secondManifest.identity.deviceId, firstManifest.identity.deviceId)
assert.equal(secondManifest.identity.accountUuid, firstManifest.identity.accountUuid)
assert.equal(config.oauth.refresh_token, 'rt-ant-bootstrap-refresh-UPDATED')
```
Source: `standalone-cli/tests/environment-bootstrap.test.ts`. [VERIFIED: repo files]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual reviewer knowledge of the Phase 05 capability inventory classification. [VERIFIED: repo files] | Phase 9 should enforce that artifact with a package-local contract test. [VERIFIED: repo files] | Repo baseline observed on 2026-04-08. [VERIFIED: repo files] | Satisfies the one remaining `QLT-01` proof area missing from the standalone suite. [VERIFIED: repo files] |
| Six-plus standalone commands listed separately in help and README. [VERIFIED: repo files] | Phase 9 should add one aggregate package-local test command for reviewers and phase gates. [VERIFIED: repo files] | Repo baseline observed on 2026-04-08; `npm --prefix standalone-cli test` currently fails. [VERIFIED: repo files] [VERIFIED: local commands] | Makes the validation surface durable and easy to rerun. [VERIFIED: repo files] |
| Two detailed docs with diverged content. [VERIFIED: repo files] | One canonical operator guide plus a thin repo-level pointer should be the standard. [VERIFIED: repo files] | Drift observed on 2026-04-08 between `standalone-cli/README.md` and `docs/standalone-cli.md`. [VERIFIED: repo files] | Prevents repeated documentation drift in later milestone maintenance. [VERIFIED: repo files] |

**Deprecated/outdated:**
- The current content of `docs/standalone-cli.md` is outdated and should not remain a second authoritative guide in its present form. [VERIFIED: repo files]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|

All claims in this research were verified from repo files, prompt context, or local command output during this session. [VERIFIED: repo files] [VERIFIED: user prompt] [VERIFIED: local commands]

## Open Questions (RESOLVED)

1. **Should the aggregate review command be exposed as `npm test` or `npm run test:all` inside `standalone-cli/`?**
   - What we know: `npm --prefix standalone-cli test` currently fails because the package has no `test` script, while all individual test scripts already exist. [VERIFIED: repo files] [VERIFIED: local commands]
   - Resolution: expose the aggregate review command as `npm test`, optionally backed by a `test:all` alias internally, because reviewers will reach for the conventional `npm test` affordance first. [VERIFIED: repo files] [VERIFIED: local commands]

2. **Should `docs/standalone-cli.md` remain as a summary or become a pure pointer?**
   - What we know: The current detailed repo-level doc is stale, while the package README already matches the live command surface better. [VERIFIED: repo files]
   - Resolution: keep `docs/standalone-cli.md` as a short repo-level overview or pointer for discoverability, but move all detailed operator procedure content to `standalone-cli/README.md` and treat that README as canonical. [VERIFIED: repo files]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `standalone-cli` build/test scripts [VERIFIED: repo files] | ✓ [VERIFIED: local commands] | `v22.19.0` [VERIFIED: local commands] | — |
| `npm` / `npx` | Package-local build and test execution [VERIFIED: repo files] | ✓ [VERIFIED: local commands] | `10.9.3` / `10.9.3` [VERIFIED: local commands] | — |
| `tsx` | Direct standalone and root TypeScript tests [VERIFIED: repo files] | ✓ via installed repo dependencies [VERIFIED: local commands] | `4.21.0` [VERIFIED: local commands] | `npx tsx ...` |
| TypeScript / `tsc` | Compile guard for root and standalone packages [VERIFIED: repo files] | ✓ via installed repo dependencies [VERIFIED: local commands] | `5.9.3` [VERIFIED: local commands] | — |
| `claude` | Optional manual smoke only; automated Phase 9 proof should not depend on it [VERIFIED: repo files] | ✓ [VERIFIED: local commands] | responds to `claude --help` [VERIFIED: local commands] | Existing `standalone-cli/tests/claude-launch.test.ts` covers the automated path. [VERIFIED: repo files] |
| `/usr/bin/security` | Optional manual macOS Keychain smoke only; automated Phase 9 proof should not depend on it [VERIFIED: repo files] | ✓ [VERIFIED: local commands] | system binary [VERIFIED: local commands] | Existing credential-discovery fixtures and injected readers cover the automated path. [VERIFIED: repo files] |

**Missing dependencies with no fallback:**
- None for the recommended Phase 9 plan. [VERIFIED: local commands] [VERIFIED: repo files]

**Missing dependencies with fallback:**
- None in this environment; even if `claude` or Keychain access were absent on another machine, the Phase 9 automated suite should still rely on existing injected tests instead of those live surfaces. [VERIFIED: repo files]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Direct `tsx` entrypoint tests with Node `assert` and package-local helpers. [VERIFIED: repo files] |
| Config file | None for the standalone package test runner. [VERIFIED: repo files] |
| Quick run command | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/operator-guidance.test.ts` after Wave 0 creates the docs contract test; until then, use the targeted existing test plus build. [VERIFIED: repo files] |
| Full suite command | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/capability-inventory.test.ts && npx tsx standalone-cli/tests/operator-guidance.test.ts && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts && npm test && npx tsx tests/config.test.ts && npm run build` after Wave 0 creates the new package-local contract tests. [VERIFIED: repo files] [VERIFIED: local commands] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QLT-01 | Capability inventory classification remains checked-in, classified, and Phase-9-relevant. [VERIFIED: repo files] | contract | `npx tsx standalone-cli/tests/capability-inventory.test.ts` | ❌ Wave 0 [VERIFIED: repo files] |
| QLT-01 | Credential detection decisions remain deterministic and secret-safe without live OAuth. [VERIFIED: repo files] | unit | `npx tsx standalone-cli/tests/credential-discovery.test.ts` | ✅ [VERIFIED: repo files] |
| QLT-01 | Bootstrap artifact generation remains deterministic and rerun-safe. [VERIFIED: repo files] | integration | `npx tsx standalone-cli/tests/environment-bootstrap.test.ts` | ✅ [VERIFIED: repo files] |
| QLT-01 | Launch environment preparation and failure guidance remain deterministic without a real external process. [VERIFIED: repo files] | integration | `npx tsx standalone-cli/tests/runtime-preparation.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts` | ✅ [VERIFIED: repo files] |
| QLT-02 | Checked-in operator docs explain first run, repeat run, missing credentials, and missing `claude`. [VERIFIED: repo files] | contract | `npx tsx standalone-cli/tests/operator-guidance.test.ts` | ❌ Wave 0 [VERIFIED: repo files] |

### Sampling Rate

- **Per task commit:** `npm --prefix standalone-cli run build` plus the targeted changed-area test. [VERIFIED: repo files]
- **Per wave merge:** Run the standalone package full suite, including the new contract tests once created. [VERIFIED: repo files]
- **Phase gate:** Standalone package full suite plus `npm test`, `npx tsx tests/config.test.ts`, and `npm run build` so the Phase 05 inventory and legacy config/reference contracts remain green. [VERIFIED: repo files] [VERIFIED: local commands]

### Wave 0 Gaps

- [ ] `standalone-cli/tests/capability-inventory.test.ts` — enforces `05-CAPABILITY-INVENTORY.md` structure, classifications, required rows, and `Known Drift` coverage for `QLT-01`. [VERIFIED: repo files]
- [ ] `standalone-cli/tests/operator-guidance.test.ts` — enforces current commands, paths, first-run/repeat-run guidance, and missing-credential / missing-`claude` recovery for `QLT-02`. [VERIFIED: repo files]
- [ ] `standalone-cli/package.json` — add an aggregate `test` or `test:all` script so reviewers can run the full standalone validation surface directly. [VERIFIED: repo files] [VERIFIED: local commands]
- [ ] `standalone-cli/README.md` — expand from command list to canonical operator runbook with workspace artifact and recovery sections. [VERIFIED: repo files]
- [ ] `docs/standalone-cli.md` — replace stale detailed content with an aligned summary or pointer to the package guide. [VERIFIED: repo files]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no [VERIFIED: repo files] | Existing auth behavior is reference context, not new Phase 9 feature work. [VERIFIED: repo files] |
| V3 Session Management | no [VERIFIED: repo files] | Phase 9 validates docs and tests rather than adding new session logic. [VERIFIED: repo files] |
| V4 Access Control | no [VERIFIED: repo files] | No new authorization boundary is introduced by the recommended Phase 9 scope. [VERIFIED: repo files] |
| V5 Input Validation | yes [VERIFIED: repo files] | Keep asserting config, credential, markdown-contract, and workspace-path inputs through existing parsers and targeted tests. [VERIFIED: repo files] |
| V6 Cryptography | no [VERIFIED: repo files] | Do not add any new crypto; Phase 9 should rely on existing token flows and secret-safe output rules. [VERIFIED: repo files] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets leaking into docs, fixtures, or test output [VERIFIED: repo files] | Information Disclosure | Use fixtures, “detected but hidden” output, and location-only recovery guidance; never copy live token values into checked-in docs or tests. [VERIFIED: repo files] |
| Shell injection or argv mutation in launch validation [VERIFIED: repo files] | Tampering / Elevation of Privilege | Preserve the existing direct child-process spawn with `shell: false` and array argv assertions. [VERIFIED: repo files] |
| Workspace path escape or stale runtime ownership mistakes in docs/tests [VERIFIED: repo files] | Tampering | Keep using `assertWorkspacePath`, symlink rejection checks, and `runtime.json` ownership gating as the documented contract. [VERIFIED: repo files] |
| False confidence from machine-specific smoke tests [VERIFIED: repo files] | Repudiation / Availability | Keep automated proof adapter-driven and reserve live smoke for optional manual verification only. [VERIFIED: repo files] |

## Sources

### Primary (HIGH confidence)

- Repo files under `standalone-cli/`, `.planning/`, `docs/`, and `AGENTS.md` loaded directly during this session, especially `standalone-cli/src/cli.ts`, `standalone-cli/src/output.ts`, `standalone-cli/src/environment/*.ts`, `standalone-cli/tests/*.test.ts`, `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md`, and `docs/standalone-cli.md`. [VERIFIED: repo files]
- Local command reruns on 2026-04-08: `npm --prefix standalone-cli run build`, all current standalone package tests, `npm test`, `npx tsx tests/config.test.ts`, `npm run build`, `npm ls typescript tsx yaml @types/node --depth=0`, `node --version`, `npm --version`, `npx --version`, and `command -v` probes for `claude` and `/usr/bin/security`. [VERIFIED: local commands]

### Secondary (MEDIUM confidence)

- None. [VERIFIED: repo files]

### Tertiary (LOW confidence)

- None. [VERIFIED: repo files]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Derived from live repo manifests plus local installed tool versions and successful reruns. [VERIFIED: repo files] [VERIFIED: local commands]
- Architecture: HIGH - Derived from current standalone package source, tests, and documented phase constraints with no external unknowns required. [VERIFIED: repo files]
- Pitfalls: HIGH - Derived from direct comparison of the live package surface against the stale repo-level doc and the missing aggregate/capability-inventory validation surface. [VERIFIED: repo files] [VERIFIED: local commands]

**Research date:** 2026-04-08
**Valid until:** 2026-04-15 because this research is tied to fast-moving local repo artifacts rather than an external stable standard. [VERIFIED: repo files]
