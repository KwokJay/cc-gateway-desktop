# Phase 06: Standalone CLI Scaffold & Credential Discovery - Research

**Researched:** 2026-04-08 [VERIFIED: repo files]  
**Domain:** isolated TypeScript CLI packaging, deterministic local Claude credential discovery, additive operator UX [VERIFIED: repo files]  
**Confidence:** HIGH [VERIFIED: repo files]

## User Constraints

No `06-CONTEXT.md` exists for this phase, so the constraints below are taken from the explicit user request, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and Phase 05 boundary artifacts. [VERIFIED: repo files]

### Locked Decisions

- The new CLI must live in an isolated future path or package and must not modify `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/`. [VERIFIED: repo files]
- Credential discovery must preserve the existing source order already captured in legacy scripts: macOS Keychain first, then `~/.claude/.credentials.json`. [VERIFIED: repo files]
- Failure output must be actionable when no usable local Claude credentials are found. [VERIFIED: repo files]
- Code, scripts, config, and tests are the source of truth when README narrative drifts. [VERIFIED: repo files]
- This phase must satisfy `ENV-01` and `ISO-02`. [VERIFIED: repo files]

### Claude's Discretion

- Exact isolated directory name, internal module layout, and package-internal test layout are not locked by a phase context file. [ASSUMED]
- The specific operator-facing command name is not locked yet, as long as the surface is clearly additive and isolated. [ASSUMED]
- Whether to add repo-root convenience scripts is discretionary, but the safer default is to keep invocation local to the isolated package during Phase 6. [ASSUMED]

### Deferred Ideas (OUT OF SCOPE)

- Generating full bootstrap artifacts, canonical identity, or runtime config beyond the minimum scaffold belongs to Phase 7. [VERIFIED: repo files]
- Starting the local runtime and launching the `claude` binary belongs to Phase 8. [VERIFIED: repo files]
- Remote admin, Docker, TLS, and multi-client distribution flows remain deferred from this milestone slice. [VERIFIED: repo files]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENV-01 | Operator can run the new standalone CLI on a machine with an existing Claude Code login and have it detect usable local Claude OAuth credentials from supported local sources or receive an actionable failure message. [VERIFIED: repo files] | Deterministic source order, source-specific parsing, source-specific error messages, and fixture-driven tests are prescribed below. [VERIFIED: repo files] |
| ISO-02 | The new CLI lives in an isolated path or package with its own entrypoint and documentation, so operators can adopt it without affecting current TS or Rust flows. [VERIFIED: repo files] | A top-level isolated package, dedicated entrypoint, package-local README, and no protected-path edits are prescribed below. [VERIFIED: repo files] |
</phase_requirements>

## Summary

Phase 6 should create a new top-level `standalone-cli/` package with its own `package.json`, `tsconfig.json`, `src/index.ts`, tests, and README, rather than placing code under `src/` or importing runtime behavior from protected legacy modules. [VERIFIED: repo files] [ASSUMED] This recommendation is driven by the Phase 05 boundary, which explicitly prohibits standalone CLI implementation inside protected legacy paths, and by the current root `tsconfig.json`, which only includes `src/` and would otherwise blur the isolation boundary. [VERIFIED: repo files]

The credential discovery contract is already concrete in the legacy scripts: on macOS, check Keychain first using `security find-generic-password -a "$USER" -s "Claude Code-credentials" -w`; if that yields nothing, fall back to `~/.claude/.credentials.json`; if both fail, tell the operator to run `claude` and finish browser login before retrying. [VERIFIED: repo files] Phase 6 should preserve that exact order and failure guidance, but implement it in TypeScript with `JSON.parse` and explicit schema checks instead of shell `eval` plus inline Python extraction. [VERIFIED: repo files] [ASSUMED]

There is a non-source `dist/standalone-cli/` artifact in the repo that appears to come from a prior experiment and directly imports legacy TS runtime modules like `../oauth.js` and `../proxy.js`. [VERIFIED: repo files] Phase 6 planning should treat those compiled artifacts as stale operational risk, not as live architecture: they violate the later isolated-package direction and reach into legacy runtime behavior that this phase is not supposed to replace. [VERIFIED: repo files]

**Primary recommendation:** Use a new top-level `standalone-cli/` TypeScript package with no new runtime dependencies, a thin additive entrypoint, a dedicated credential-discovery module, and fixture-based tests that prove source order and actionable failure messaging. [VERIFIED: repo files] [ASSUMED]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `v22.19.0` locally, repo expects `22+` [VERIFIED: local command] [VERIFIED: repo files] | CLI runtime and child-process / filesystem access [VERIFIED: repo files] | Matches the existing repo runtime contract and is already installed in this workspace. [VERIFIED: repo files] [VERIFIED: local command] |
| TypeScript | root devDependency `^5.7.0` [VERIFIED: repo files] | Compile the isolated CLI package [ASSUMED] | Matches the existing root TS toolchain and avoids introducing a second compiler stack. [VERIFIED: repo files] |
| `tsx` | root devDependency `^4.19.0` [VERIFIED: repo files] | Run package-local tests and dev entrypoints without additional wiring [VERIFIED: repo files] | The repo already uses direct `tsx` test execution instead of Jest/Vitest for the root TS surface. [VERIFIED: repo files] |
| Node stdlib (`fs`, `path`, `os`, `child_process`, `assert`) | bundled [VERIFIED: repo files] | Credential lookup, JSON parsing, CLI output, and tests [ASSUMED] | Phase 6 does not need extra runtime dependencies; the needed primitives are already available. [VERIFIED: repo files] [ASSUMED] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `/usr/bin/security` on macOS | available in this environment [VERIFIED: local command] | Primary credential-source probe for Keychain-backed Claude login data [VERIFIED: local command] | Use only on `darwin`, before file fallback, with stdout-only retrieval semantics from `-w`. [VERIFIED: local command] [VERIFIED: repo files] |
| `claude` binary | `2.1.92` locally [VERIFIED: local command] | Manual operator setup prerequisite and later launch target [VERIFIED: local command] | Not required to satisfy Phase 6 itself, but useful for manual credential-source setup and later phases. [VERIFIED: repo files] [VERIFIED: local command] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Top-level `standalone-cli/` package [ASSUMED] | `src/standalone-cli/` [ASSUMED] | Rejected because `src/` is a protected legacy path for this milestone and the root `tsconfig.json` would collapse the isolation boundary. [VERIFIED: repo files] |
| Typed TS credential parsing [ASSUMED] | Bash + `python3 -c` extraction like legacy scripts [VERIFIED: repo files] | Rejected because shell parsing is harder to test, easier to leak secrets through stdout, and does not fit an isolated TS CLI package well. [VERIFIED: repo files] [ASSUMED] |
| `/usr/bin/security` command adapter [ASSUMED] | Native Node keychain dependency [ASSUMED] | Rejected because the repo forbids new dependencies by default and the canonical source order already depends on the system `security` tool. [VERIFIED: repo files] [VERIFIED: local command] |

**Installation:** [VERIFIED: repo files]

```bash
# Phase 6 should reuse the existing repo toolchain.
npm install
```

**Version verification:** The research recommendation is to reuse the repo-pinned TypeScript toolchain rather than introduce new package names during Phase 6. [VERIFIED: repo files]

## Architecture Patterns

### Recommended Project Structure

```text
standalone-cli/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── output.ts
│   └── credential-discovery/
│       ├── discover.ts
│       ├── parse.ts
│       └── sources/
│           ├── keychain.ts
│           └── credentials-file.ts
└── tests/
    ├── credential-discovery.test.ts
    └── cli-help.test.ts
```

This keeps the new surface visibly additive, package-local, and separate from all protected legacy paths. [VERIFIED: repo files] [ASSUMED]

### Pattern 1: Thin Entrypoint, Source Adapters, Shared Result Shape

**What:** Keep `src/index.ts` small; delegate discovery order and parsing to dedicated modules, and return a typed success-or-failure result that the CLI can render. [ASSUMED]  
**When to use:** Immediately in Phase 6, because the phase goal is scaffold plus deterministic discovery rather than runtime startup. [VERIFIED: repo files]  
**Example:**  

```typescript
type DiscoverySource = 'macos-keychain' | 'credentials-file'

type DiscoveryResult =
  | { ok: true; source: DiscoverySource; accessToken?: string; refreshToken: string; expiresAt?: number; email?: string }
  | { ok: false; source: DiscoverySource; reason: string }

export async function discoverClaudeCredentials(): Promise<DiscoveryResult> {
  const candidates =
    process.platform === 'darwin'
      ? [readMacOsKeychain, readCredentialsFile]
      : [readCredentialsFile]

  const failures: DiscoveryResult[] = []

  for (const readSource of candidates) {
    const result = await readSource()
    if (result.ok) return result
    failures.push(result)
  }

  throw buildActionableDiscoveryError(failures)
}
```

Source basis: legacy scripts define the same ordered sources and failure flow. [VERIFIED: repo files]

### Pattern 2: Parse Once, Validate Shape Explicitly, Never `eval`

**What:** Parse credential JSON into a typed object, validate `claudeAiOauth.refreshToken`, and treat missing or malformed structures as actionable parse failures rather than partial success. [VERIFIED: repo files] [ASSUMED]  
**When to use:** For both Keychain stdout and file contents, because both sources feed the same JSON structure in the legacy scripts. [VERIFIED: repo files]  
**Example:**  

```typescript
type RawClaudeCredentials = {
  claudeAiOauth?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    email?: string
    emailAddress?: string
  }
  email?: string
  emailAddress?: string
}

export function parseClaudeCredentials(raw: string) {
  const parsed = JSON.parse(raw) as RawClaudeCredentials
  const oauth = parsed.claudeAiOauth

  if (!oauth?.refreshToken) {
    throw new Error('Claude credentials found, but refreshToken is missing')
  }

  return {
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken,
    expiresAt: oauth.expiresAt,
    email: oauth.email ?? oauth.emailAddress ?? parsed.email ?? parsed.emailAddress,
  }
}
```

Source basis: the legacy scripts extract `access_token`, `refresh_token`, and `expires_at` from `claudeAiOauth`, and `src/config.ts` treats a missing `oauth.refresh_token` as a hard failure. [VERIFIED: repo files]

### Pattern 3: Additive Operator Messaging in Help Text and README

**What:** State in `--help` and `standalone-cli/README.md` that the new CLI is additive, Phase-6-scoped bootstrap work and does not replace the legacy TypeScript gateway, Rust daemon, Rust CLI, or desktop app. [VERIFIED: repo files] [ASSUMED]  
**When to use:** At initial scaffold time, not as a later documentation cleanup. [VERIFIED: repo files]  
**Example:**  

```text
This CLI is an additive bootstrap surface for local Claude credential discovery.
It does not replace the legacy TypeScript gateway, Rust daemon, Rust CLI, or desktop app.
```

Source basis: `ISO-02` and the Phase 05 isolation boundary require an additive isolated surface. [VERIFIED: repo files]

### Anti-Patterns to Avoid

- **Putting live Phase 6 code under `src/`:** This breaks the protected-path boundary and makes the new CLI look like an extension of the legacy gateway instead of an isolated package. [VERIFIED: repo files]
- **Importing `../oauth.js`, `../proxy.js`, or other legacy runtime modules into the new CLI scaffold:** The stale `dist/standalone-cli` artifact demonstrates this coupling pattern, and it reaches into behavior that belongs to later phases rather than Phase 6. [VERIFIED: repo files]
- **Using shell `eval` or raw stdout dumps for credential parsing:** The legacy scripts do this because they are shell scripts, but the TypeScript CLI should not. [VERIFIED: repo files] [ASSUMED]
- **Logging raw token values or writing them to docs/help output:** This violates the repo’s security constraint around OAuth and client-token exposure. [VERIFIED: repo files]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| macOS Keychain access [VERIFIED: local command] | Native addon or custom keychain binding [ASSUMED] | A thin `child_process` adapter around `/usr/bin/security find-generic-password ... -w` [VERIFIED: local command] [ASSUMED] | The repo already treats `security` as the canonical source, and Phase 6 does not need a new dependency. [VERIFIED: repo files] |
| Credential JSON extraction [VERIFIED: repo files] | Shell `eval` plus inline Python [VERIFIED: repo files] | `JSON.parse` plus explicit TS shape validation [ASSUMED] | Safer, easier to unit test, and easier to keep secret-safe. [ASSUMED] |
| Operator-facing “is this additive?” explanation [VERIFIED: repo files] | Scattered comments only [ASSUMED] | One clear README statement plus one clear `--help` statement [ASSUMED] | Operators need to see the isolation boundary from the command surface, not by reading planning docs. [VERIFIED: repo files] [ASSUMED] |
| Phase-6 verification [VERIFIED: repo files] | Manual checks against real local credentials only [ASSUMED] | Fixture-driven tests with mocked keychain/file responses plus one optional manual smoke step [ASSUMED] | `QLT-01` explicitly forbids dependence on live OAuth traffic for core behavior. [VERIFIED: repo files] |

**Key insight:** Phase 6 is a contract-definition phase for an isolated CLI surface, not a runtime-orchestration phase; the safest implementation is a small typed package that proves discovery order and additive messaging without reaching into later-phase gateway startup behavior. [VERIFIED: repo files] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Choosing an Isolated Name but a Non-Isolated Path

**What goes wrong:** A developer creates `src/standalone-cli` or revives compiled artifacts under `dist/standalone-cli` and assumes that counts as isolation. [VERIFIED: repo files]  
**Why it happens:** The repo already contains stale compiled `dist/standalone-cli` files, which can create false confidence that an in-tree legacy placement is acceptable. [VERIFIED: repo files]  
**How to avoid:** Put the real Phase 6 code in a new top-level package and treat `dist/standalone-cli` as stale output, not as source. [VERIFIED: repo files] [ASSUMED]  
**Warning signs:** The implementation imports `../oauth.js` or `../proxy.js`, or the build depends on the root `src/` compilation path. [VERIFIED: repo files]

### Pitfall 2: Treating “No Keychain Item” as a Terminal Error on macOS

**What goes wrong:** The CLI stops after Keychain lookup fails and never checks `~/.claude/.credentials.json`. [VERIFIED: repo files]  
**Why it happens:** `security find-generic-password` is the primary source, so it is easy to confuse primary with exclusive. [VERIFIED: local command] [VERIFIED: repo files]  
**How to avoid:** Always implement explicit ordered fallback: Keychain first on macOS, file second everywhere it exists. [VERIFIED: repo files]  
**Warning signs:** The code returns on first failed source probe instead of collecting failures and trying the next source. [ASSUMED]

### Pitfall 3: Printing Secret Material While Trying to Be Helpful

**What goes wrong:** Debug output, docs, or failure messages include raw `refreshToken` or `accessToken` values. [VERIFIED: repo files]  
**Why it happens:** The legacy extraction script prints the raw refresh token as an operator handoff aid, but the standalone CLI is supposed to be an additive local bootstrap tool, not a token copy utility. [VERIFIED: repo files] [ASSUMED]  
**How to avoid:** Only report source, success/failure, and masked identifiers; never echo raw credential values in Phase 6. [ASSUMED]  
**Warning signs:** Any codepath calls `console.log(parsed.claudeAiOauth.refreshToken)` or returns raw token data in help/status output. [ASSUMED]

### Pitfall 4: Letting Manual Environment State Drive Test Design

**What goes wrong:** Tests depend on the local machine having a logged-in Claude session, a specific Keychain item, or a real `~/.claude/.credentials.json`. [VERIFIED: local command]  
**Why it happens:** Credential discovery feels inherently environment-dependent, so it is tempting to test only with live local state. [ASSUMED]  
**How to avoid:** Put the source-specific readers behind adapters and test them with fixtures/stubs; keep live credential checks as optional manual smoke only. [ASSUMED]  
**Warning signs:** CI would fail without a real Claude login, or tests read `$HOME` directly instead of a temp fixture path. [ASSUMED]

## Code Examples

Verified patterns from repo and local command sources:

### Deterministic Source Order

```typescript
const orderedSources =
  process.platform === 'darwin'
    ? [readMacOsKeychain, readCredentialsFile]
    : [readCredentialsFile]
```

Source: legacy setup and token-extraction scripts check Keychain first, then the `~/.claude/.credentials.json` fallback. [VERIFIED: repo files]

### Source-Specific Error Rendering

```typescript
export function renderCredentialFailure(): string {
  return [
    'No Claude Code credentials found.',
    "Run 'claude' once and complete browser OAuth login, then retry.",
    process.platform === 'darwin'
      ? 'Checked: macOS Keychain, ~/.claude/.credentials.json'
      : 'Checked: ~/.claude/.credentials.json',
  ].join('\n')
}
```

Source: legacy scripts already use this recovery action and source list as the operator-facing failure path. [VERIFIED: repo files]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shell setup scripts (`quick-setup.sh`, `admin-setup.sh`, `extract-token.sh`) do credential discovery inline with shell + Python. [VERIFIED: repo files] | Phase 6 should move discovery into a dedicated isolated TS package with typed parsing and package-local tests. [ASSUMED] | Planned in milestone v1.1 on 2026-04-08. [VERIFIED: repo files] | Better isolation, clearer docs, and deterministic automated verification for `ENV-01` / `ISO-02`. [VERIFIED: repo files] [ASSUMED] |
| Stale compiled `dist/standalone-cli` artifact imports legacy runtime modules directly. [VERIFIED: repo files] | Treat compiled artifact as non-authoritative and replace it with a top-level package that does not live under protected legacy paths. [VERIFIED: repo files] [ASSUMED] | Phase 05 boundary made isolated-package direction explicit on 2026-04-08. [VERIFIED: repo files] | Prevents architectural confusion and avoids misleading operators into thinking the new CLI replaces the legacy gateway path. [VERIFIED: repo files] [ASSUMED] |

**Deprecated/outdated:**

- `dist/standalone-cli/` as architecture evidence is outdated because the corresponding source tree is absent and the compiled entrypoint reaches into legacy TS runtime modules that Phase 6 is not supposed to own. [VERIFIED: repo files]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new top-level `standalone-cli/` directory is the best isolated package location for Phase 6. [ASSUMED] | Architecture Patterns | Low to medium — the plan would need path renaming if the team prefers `packages/` or `tools/`, but the isolation principle would still hold. |
| A2 | Phase 6 should not add repo-root convenience scripts yet, because package-local invocation reduces operator confusion during the additive scaffold stage. [ASSUMED] | User Constraints / Architecture Patterns | Low — root convenience scripts can be added later if adoption ergonomics matter more than strict package locality. |
| A3 | The standalone CLI should use TS-native parsing instead of reproducing shell + Python extraction behavior verbatim. [ASSUMED] | Standard Stack / Don't Hand-Roll | Low — even if implementation details differ, the discovery order and operator-facing contract remain the real locked behavior. |

## Open Questions (RESOLVED)

1. **What should the public command name be during the additive stage?**
   - What we know: the root repo already has a Rust `ccg` launcher, and Phase 6 must avoid confusing operators about replacement status. [VERIFIED: repo files]
   - Resolution: keep the Phase 6 command package-local and distinct from `ccg`, with no claim of replacing the Rust launcher yet. The plan should favor a temporary additive binary name inside the isolated package and defer any public command-name convergence until later phases prove the end-to-end flow. [ASSUMED]

2. **Should the CLI treat malformed credential JSON as “no credentials” or as a distinct schema-drift failure?**
   - What we know: legacy scripts assume the `claudeAiOauth` structure and report that raw structure may have changed when extraction fails. [VERIFIED: repo files]
   - Resolution: treat malformed credential JSON as a distinct schema or parse failure, not as generic “not found”, so operators can tell the difference between “you have not logged in” and “the credential shape changed”. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Phase 6 isolated TS CLI runtime [VERIFIED: repo files] | ✓ [VERIFIED: local command] | `v22.19.0` [VERIFIED: local command] | — |
| npm / npx | Package-local build and test commands [VERIFIED: repo files] | ✓ [VERIFIED: local command] | `10.9.3` [VERIFIED: local command] | — |
| `/usr/bin/security` | Primary macOS credential-source probe [VERIFIED: repo files] | ✓ [VERIFIED: local command] | system tool, usage confirmed locally [VERIFIED: local command] | `~/.claude/.credentials.json` fallback [VERIFIED: repo files] |
| `~/.claude/.credentials.json` | Secondary credential-source probe [VERIFIED: repo files] | ✗ on this machine [VERIFIED: local command] | — | macOS Keychain first [VERIFIED: repo files] |
| Claude Code Keychain item (`Claude Code-credentials`) | Primary live credential source on macOS [VERIFIED: repo files] | ✗ on this machine [VERIFIED: local command] | — | `~/.claude/.credentials.json` fallback if present [VERIFIED: repo files] |
| `claude` binary | Manual setup smoke and later launch phases [VERIFIED: repo files] | ✓ [VERIFIED: local command] | `2.1.92` [VERIFIED: local command] | — |

**Missing dependencies with no fallback:**

- No live local Claude credential source is present on this machine right now, so manual end-to-end credential-discovery smoke tests would fail until the operator logs into Claude Code locally. [VERIFIED: local command]

**Missing dependencies with fallback:**

- The file fallback source is absent locally, but the primary macOS Keychain source remains the intended first probe on machines that have completed Claude login. [VERIFIED: repo files]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Direct TypeScript test files executed with `tsx`, matching the existing root TS test pattern. [VERIFIED: repo files] |
| Config file | none at repo root for TS tests; current tests are direct `tsx` entry scripts. [VERIFIED: repo files] |
| Quick run command | `npx tsx standalone-cli/tests/credential-discovery.test.ts` [ASSUMED] |
| Full suite command | `npm test && npx tsx tests/config.test.ts && npm run build && npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/credential-discovery.test.ts` [ASSUMED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENV-01 | Deterministic credential source order with actionable failure output [VERIFIED: repo files] | unit / smoke [ASSUMED] | `npx tsx standalone-cli/tests/credential-discovery.test.ts` [ASSUMED] | ❌ Wave 0 [VERIFIED: repo files] |
| ISO-02 | Isolated package, entrypoint, and additive docs [VERIFIED: repo files] | smoke / file-contract [ASSUMED] | `npm --prefix standalone-cli run build` plus a small doc/help assertion test [ASSUMED] | ❌ Wave 0 [VERIFIED: repo files] |

### Sampling Rate

- **Per task commit:** `npx tsx standalone-cli/tests/credential-discovery.test.ts` [ASSUMED]
- **Per wave merge:** `npm test && npx tsx tests/config.test.ts && npm run build && npm --prefix standalone-cli run build` [ASSUMED]
- **Phase gate:** Additive docs present, package-local build passes, and source-order tests prove Keychain-first/file-second behavior before `/gsd-verify-work`. [VERIFIED: repo files] [ASSUMED]

### Wave 0 Gaps

- [ ] `standalone-cli/package.json` — define an isolated package boundary and its own entrypoint. [ASSUMED]
- [ ] `standalone-cli/tsconfig.json` — compile the isolated package without relying on the root `tsconfig.json` include list. [VERIFIED: repo files] [ASSUMED]
- [ ] `standalone-cli/src/index.ts` — additive CLI help + command dispatch entrypoint. [ASSUMED]
- [ ] `standalone-cli/src/credential-discovery/*` — source adapters and parser modules. [ASSUMED]
- [ ] `standalone-cli/tests/credential-discovery.test.ts` — fixture-driven source-order and failure-message coverage for `ENV-01`. [ASSUMED]
- [ ] `standalone-cli/README.md` — operator-facing additive positioning for `ISO-02`. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no [ASSUMED] | Phase 6 discovers existing local OAuth material but does not implement a new end-user login flow. [ASSUMED] |
| V3 Session Management | no [ASSUMED] | Session lifecycle remains outside this scaffold-only phase. [ASSUMED] |
| V4 Access Control | no [ASSUMED] | No new authorization boundary is introduced in Phase 6. [ASSUMED] |
| V5 Input Validation | yes [VERIFIED: repo files] | Validate credential JSON shape and required `refreshToken` before using any discovered source data. [VERIFIED: repo files] [ASSUMED] |
| V6 Cryptography | no [ASSUMED] | Phase 6 should not introduce new crypto; it only reads existing local credential material. [ASSUMED] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Raw OAuth token leakage in logs or help text [VERIFIED: repo files] | Information Disclosure | Never print raw `accessToken` or `refreshToken`; show only source and masked identifiers if needed. [ASSUMED] |
| Command spoofing via `PATH` when invoking Keychain tooling [ASSUMED] | Tampering | Use `/usr/bin/security` on macOS rather than relying on a user-controlled `PATH` lookup. [VERIFIED: local command] [ASSUMED] |
| Malformed or drifted credential JSON shape [VERIFIED: repo files] | Denial of Service / Integrity | Parse once, validate required keys, and surface schema-drift failures distinctly from “not found”. [ASSUMED] |
| Reading credentials from the wrong home directory in tests [ASSUMED] | Information Disclosure | Inject source paths in tests and keep `$HOME` access isolated behind source adapters. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` - phase requirement definitions for `ENV-01` and `ISO-02`. [VERIFIED: repo files]
- `.planning/ROADMAP.md` - Phase 6 goal and success criteria. [VERIFIED: repo files]
- `.planning/STATE.md` - current milestone focus and active blocker notes. [VERIFIED: repo files]
- `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md` - authoritative capability inventory and credential-discovery classification. [VERIFIED: repo files]
- `.planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md` - protected legacy paths and isolated future-package requirement. [VERIFIED: repo files]
- `package.json` and `tsconfig.json` - current root TypeScript tooling and build boundary. [VERIFIED: repo files]
- `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, `scripts/extract-token.sh`, `scripts/add-client.sh` - actual source order, recovery messaging, and operator-facing launcher semantics. [VERIFIED: repo files]
- `src/config.ts` and `tests/config.test.ts` - config-validation expectations and existing root test pattern. [VERIFIED: repo files]
- `security help find-generic-password` - local usage contract for the primary macOS credential-source command. [VERIFIED: local command]
- Local environment probes: `node --version`, `npm --version`, `npx --version`, `claude --version`, `security find-generic-password ...`, and `ls ~/.claude/.credentials.json`. [VERIFIED: local command]

### Secondary (MEDIUM confidence)

- None. [VERIFIED: repo files]

### Tertiary (LOW confidence)

- None. [VERIFIED: repo files]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - derived from current repo manifests and local tool availability rather than hypothetical future tooling. [VERIFIED: repo files] [VERIFIED: local command]
- Architecture: MEDIUM-HIGH - the isolation rule is verified, but the exact top-level package name is still a recommendation. [VERIFIED: repo files] [ASSUMED]
- Pitfalls: HIGH - the major failure modes are directly evidenced by legacy scripts, Phase 05 boundary rules, and stale compiled artifacts in `dist/standalone-cli`. [VERIFIED: repo files]

**Research date:** 2026-04-08 [VERIFIED: repo files]  
**Valid until:** 2026-05-08 for repo-local planning inputs unless Phase 06 scope decisions change earlier. [ASSUMED]
