# Phase 5: TS Backend Capability Inventory - Research

**Researched:** 2026-04-08
**Domain:** Source-backed inventory and isolation planning for the legacy TypeScript backend
**Confidence:** HIGH

<user_constraints>
## User Constraints

- No phase-specific `05-CONTEXT.md` exists, so the active scope comes from the user prompt plus `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/PROJECT.md`. [VERIFIED: phase init output, phase dir listing, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md]
- Phase 5 must document the TypeScript backend's runtime, setup, auth, config, and launch capabilities from source files and scripts rather than assumptions. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, user prompt]
- Phase 5 must classify each analyzed capability as `must-port`, `reference-only`, or `deferred` for the new CLI milestone. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, user prompt]
- Phase 5 must record an explicit isolation boundary stating that existing TypeScript gateway files, setup scripts, Rust daemon, Rust CLI, and desktop app remain unchanged while the new CLI is developed. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md]
- The milestone is additive: later phases build a new standalone CLI derived from the TypeScript backend surface without rewriting the legacy TypeScript or Rust programs. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md]
- No repo-local `CLAUDE.md` file exists, and no repo-specific skills were found under `.claude/skills/` or `.agents/skills/`. [VERIFIED: filesystem checks for `CLAUDE.md`, `.claude/skills`, `.agents/skills`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANA-01 | Operator can read a checked-in inventory of the TypeScript backend's runtime, setup, auth, config, and launch capabilities that matter to the new CLI. [VERIFIED: .planning/REQUIREMENTS.md] | Sections `Summary`, `Architecture Patterns`, `Don't Hand-Roll`, `Code Examples`, and `Validation Architecture` define the evidence sources and the recommended inventory shape. [VERIFIED: this research document] |
| ANA-02 | Each analyzed TypeScript capability is classified as must-port, reference-only, or deferred for the new CLI milestone. [VERIFIED: .planning/REQUIREMENTS.md] | Sections `Summary`, `Architecture Patterns`, and `Common Pitfalls` recommend a capability matrix with explicit classification rules tied to milestone requirements. [VERIFIED: this research document] |
| ISO-01 | Existing TypeScript gateway files, setup scripts, Rust daemon, Rust CLI, and desktop app remain behaviorally and structurally unchanged by the new CLI milestone. [VERIFIED: .planning/REQUIREMENTS.md] | Sections `Summary`, `Architecture Patterns`, `Common Pitfalls`, and `Validation Architecture` define the boundary contract and the verification guardrails for unchanged legacy paths. [VERIFIED: this research document] |
</phase_requirements>

## Summary

Phase 5 should be planned as a documentation-and-boundary phase, not as an implementation phase. The legacy TypeScript surface that matters to the milestone is spread across `src/index.ts`, `src/config.ts`, `src/auth.ts`, `src/oauth.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/proxy-agent.ts`, `src/scripts/*.ts`, and `scripts/*.sh`, with supporting expectations in `config.example.yaml`, `package.json`, `README.md`, `tests/*.test.ts`, and `docs/rust-ts-parity-checklist.md`. [VERIFIED: src/index.ts, src/config.ts, src/auth.ts, src/oauth.ts, src/proxy.ts, src/rewriter.ts, src/proxy-agent.ts, src/scripts/generate-token.ts, src/scripts/generate-identity.ts, scripts/quick-setup.sh, scripts/add-client.sh, scripts/admin-setup.sh, scripts/extract-token.sh, config.example.yaml, package.json, README.md, tests/config.test.ts, tests/oauth.test.ts, tests/rewriter.test.ts, docs/rust-ts-parity-checklist.md]

The most important planning insight is that the TypeScript backend surface is broader than "proxy logic." It includes bootstrap flows that extract Claude credentials from macOS Keychain or `~/.claude/.credentials.json`, generate config and launcher artifacts, honor outbound proxy environment variables, expose health and verification endpoints, and launch `claude` with gateway-specific environment variables. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, scripts/add-client.sh, src/proxy-agent.ts, src/proxy.ts] Any inventory that only catalogs request rewriting will miss later Phase 6 to Phase 8 dependencies. [VERIFIED: .planning/ROADMAP.md] (inference)

The second planning insight is that source files already disagree with some README narrative, so the inventory must treat code and scripts as the authority and record drift explicitly. The README still describes OAuth auto-refresh "5 minutes before expiry," while the current TypeScript code and tests refresh at actual expiry with a 1 second minimum delay. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts] The README changelog says the CCH hash implementation is a fallback and "not active by default," while the current `rewriteMessagesBody` still computes a hash before system prompt rewriting even though billing-header blocks are stripped. [VERIFIED: README.md, src/rewriter.ts]

**Primary recommendation:** Plan Phase 5 around a checked-in, source-cited capability matrix plus a separate isolation-boundary note; do not modify `src/`, `scripts/`, or any Rust path during this phase. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md] (inference)

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Node.js | `22+` in repo docs, `v22.19.0` on this machine | Runs the legacy TS gateway, scripts, tests, and build. [VERIFIED: README.md, package.json, local `node --version`] | Phase 5 evidence gathering and later CLI derivation both depend on the existing Node runtime surface, not a new runtime. [VERIFIED: package.json, .planning/PROJECT.md] |
| TypeScript | `^5.7.0` | Compiles the root TypeScript backend. [VERIFIED: package.json] | The TS backend is the reference surface being inventoried, so its own compiler contract is the planning baseline. [VERIFIED: package.json, .planning/ROADMAP.md] |
| `tsx` | `^4.19.0` | Runs the root dev server and the existing TS tests. [VERIFIED: package.json] | It is the current root execution and test harness the planner can reuse without adding dependencies. [VERIFIED: package.json] |
| `yaml` | `^2.7.0` | Parses `config.yaml`. [VERIFIED: package.json, src/config.ts] | Config parsing is one of the explicit capabilities the inventory must document. [VERIFIED: .planning/REQUIREMENTS.md, src/config.ts] |
| `https-proxy-agent` | `^9.0.0` | Applies outbound proxy env vars to OAuth and upstream HTTP calls. [VERIFIED: package.json, src/proxy-agent.ts, src/oauth.ts, src/proxy.ts] | Proxy-awareness is already part of the TS backend behavior and later milestone requirements. [VERIFIED: .planning/REQUIREMENTS.md, README.md] |
| Bash + `security` + `python3` + `openssl` | `security` available, `Python 3.14.0`, `OpenSSL 1.1.1t` on this machine | Powers credential extraction, token/identity generation, TLS cert generation, and launcher script creation. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, scripts/add-client.sh, local version checks] | Setup and launch capabilities are script-defined today, so Phase 5 has to inventory them as first-class reference behavior. [VERIFIED: user prompt, .planning/ROADMAP.md, scripts/*.sh] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `tsc` build | from `typescript ^5.7.0` | Verifies the root TS backend still compiles. [VERIFIED: package.json, local `npm run build`] | Use as the minimum build guard for any documentation phase that promises unchanged TS paths. [VERIFIED: .planning/REQUIREMENTS.md, local `npm run build`] |
| Root TS tests | `tsx tests/rewriter.test.ts && tsx tests/oauth.test.ts` plus standalone `tests/config.test.ts` | Protect current rewrite, OAuth, and config semantics. [VERIFIED: package.json, tests/config.test.ts, tests/oauth.test.ts, tests/rewriter.test.ts, local test runs] | Use them to confirm which inventory claims are backed by automation and which still need manual/source review. [VERIFIED: local `npm test`, local `npx tsx tests/config.test.ts`] |
| `curl` in launcher scripts | system tool | Probes `/_health` from client launchers and setup scripts. [VERIFIED: scripts/add-client.sh, scripts/admin-setup.sh] | Use it as the current health-check behavior when documenting launch readiness. [VERIFIED: scripts/add-client.sh, scripts/admin-setup.sh] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| README-driven inventory | Source-backed inventory from `src/`, `scripts/`, `tests/`, and config/docs | README already drifts from code in OAuth refresh timing and CCH behavior, so docs-only inventory would mislead later phases. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts] |
| Reclassifying capabilities from desired future architecture | Reclassifying from current milestone requirements plus current source behavior | Planning against aspiration would blur the isolation boundary and encourage premature legacy edits. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md] |
| Editing legacy paths to "simplify" the inventory | Leaving legacy TS/Rust paths untouched and writing new artifacts only | Phase 5 success explicitly requires unchanged TS and Rust paths. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md] |

**Installation:**

```bash
npm install
```

This phase should use the existing repo toolchain only and should not add dependencies. [VERIFIED: AGENTS.md working agreements, package.json, .planning/research/SUMMARY.md]

**Version verification:** For this phase, the relevant versions are the repo-pinned toolchain and the locally available execution environment, not latest-registry packages, because Phase 5 plans against the checked-in TS backend rather than introducing new libraries. [VERIFIED: package.json, local version checks, .planning/ROADMAP.md]

## Architecture Patterns

### Recommended Project Structure

```text
src/                 # Legacy TS runtime surface to inventory, not edit
scripts/             # Bootstrap, credential, launcher, and deployment behavior to inventory
tests/               # Existing proof for config, OAuth, and rewrite semantics
docs/                # Parity/drift context that helps classify reference behavior
.planning/phases/05-ts-backend-capability-inventory/
  05-RESEARCH.md     # This research
  05-INVENTORY.md    # Recommended phase output: source-backed capability matrix
  05-BOUNDARY.md     # Recommended phase output: explicit isolation contract
```

The phase should add planning artifacts, not product code. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md] (inference)

### Pattern 1: Source-Backed Capability Matrix

**What:** Build one table where every capability row includes category, current behavior, source files, classification, downstream phase consumer, and open questions. [VERIFIED: phase goals in .planning/ROADMAP.md, .planning/REQUIREMENTS.md] (inference)

**When to use:** Use for every TS backend capability that later phases might preserve or intentionally leave behind, including runtime startup, config loading, auth, OAuth, proxy-env support, health endpoints, credential extraction, config generation, launcher generation, and `claude` launch handoff. [VERIFIED: src/index.ts, src/config.ts, src/auth.ts, src/oauth.ts, src/proxy.ts, src/proxy-agent.ts, scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, scripts/add-client.sh]

**Recommended row shape:** `Category | Capability | Current TS behavior | Evidence | Classification | Why | Used by future phase?`. [VERIFIED: ANA-01, ANA-02 in .planning/REQUIREMENTS.md] (inference)

### Pattern 2: Boundary-First Documentation

**What:** Write a separate boundary note that explicitly says Phase 5 is documentation-only and that `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, and `crates/desktop/` remain unchanged during the milestone unless a later phase explicitly authorizes new isolated CLI code. [VERIFIED: .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md]

**When to use:** Use before any classification debate, so future phases cannot reinterpret the inventory as permission to edit legacy code paths. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md] (inference)

**Example:**

```markdown
Legacy TS and Rust paths are reference surfaces for this milestone.
New CLI work must live in an isolated path/package and must not change
existing `src/`, `scripts/`, or Rust product paths.
```

Source: milestone requirements and roadmap. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md]

### Pattern 3: Drift Audit Beside the Inventory

**What:** Record where code, scripts, tests, and README disagree so later phases port the live behavior, not the stale narrative. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts]

**When to use:** Use whenever a capability is described in README or parity docs and separately implemented in `src/` or `scripts/`. [VERIFIED: README.md, docs/rust-ts-parity-checklist.md, src/*.ts, scripts/*.sh]

**Minimum drift items already found:**
- README says OAuth auto-refresh happens 5 minutes before expiry, but the current code and tests refresh at actual expiry with `Math.max(msUntilExpiry, 1000)`. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts]
- README changelog says the CCH hash is fallback-only and not active by default, but `rewriteMessagesBody` still computes a hash during `/v1/messages` rewriting before system prompt rewriting. [VERIFIED: README.md, src/rewriter.ts]
- Root `npm test` does not include `tests/config.test.ts`, even though config behavior is central to this milestone. [VERIFIED: package.json, tests/config.test.ts, local `npm test`, local `npx tsx tests/config.test.ts`]

### Anti-Patterns to Avoid

- **README-as-truth:** Do not classify capabilities from README prose alone when the source files or tests disagree. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts]
- **Proxy-only inventory:** Do not limit the matrix to request rewriting; later phases depend on bootstrap, credential, config, and launcher behavior too. [VERIFIED: .planning/ROADMAP.md, scripts/*.sh, src/proxy.ts, src/config.ts]
- **Silent scope creep:** Do not edit legacy TS or Rust paths during this phase; the boundary itself is a required deliverable. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md]
- **Unstructured classification:** Do not bury `must-port` vs `reference-only` vs `deferred` inside prose; make the classification machine-scannable in a table. [VERIFIED: ANA-02 in .planning/REQUIREMENTS.md] (inference)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capability discovery | Runtime poking or speculative notes | A static source-cited matrix linked to specific files and tests | The current repo already exposes the needed behavior in code and scripts, and Phase 5 needs auditability more than dynamic introspection. [VERIFIED: phase goal in .planning/ROADMAP.md, source files listed above] |
| Boundary enforcement | Informal "we won't touch legacy code" promises | An explicit checked-in boundary document plus verification commands | ISO-01 is a milestone requirement, not a social convention. [VERIFIED: .planning/REQUIREMENTS.md] |
| Classification logic | Ad hoc narrative descriptions | Table columns with fixed values `must-port`, `reference-only`, `deferred` | Later planners need unambiguous inputs they can sequence against. [VERIFIED: ANA-02 in .planning/REQUIREMENTS.md] |
| Setup/launch understanding | Re-implementing shell behavior mentally | Source review of `quick-setup.sh`, `admin-setup.sh`, `extract-token.sh`, and `add-client.sh` | The setup and launch surfaces are script-defined today and include credential-source order, fallback behavior, and operator-facing messaging. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, scripts/add-client.sh] |

**Key insight:** For this phase, "hand-rolled" means inventing a cleaner story than the repo actually implements. The planner needs the messy, source-backed truth because later isolated CLI work depends on it. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md, source review] (inference)

## Common Pitfalls

### Pitfall 1: Treating README Behavior as Canonical

**What goes wrong:** Later phases port README descriptions instead of live TS behavior. [VERIFIED: README.md, source review]
**Why it happens:** The README is broad and operator-friendly, but it is not kept perfectly in sync with implementation details. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts]
**How to avoid:** Put a `Source of truth` column in the inventory and require every row to cite code or script files first, docs second. [VERIFIED: ANA-01 in .planning/REQUIREMENTS.md] (inference)
**Warning signs:** A row cites only README text, or a capability has no code/script/test reference. [VERIFIED: planning requirements plus current drift findings] (inference)

### Pitfall 2: Missing Script-Defined Capabilities

**What goes wrong:** The inventory captures `src/` modules but misses credential extraction, launcher generation, TLS bootstrapping, or client routing behavior defined in shell scripts. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, scripts/add-client.sh]
**Why it happens:** Those behaviors live outside the TypeScript runtime tree even though they are part of the current TS backend operator story. [VERIFIED: scripts/*.sh, README.md]
**How to avoid:** Inventory `scripts/` as a first-class capability source and keep separate categories for `setup`, `auth source discovery`, `artifact generation`, and `launch`. [VERIFIED: phase goal categories from user prompt and roadmap] (inference)
**Warning signs:** The inventory has rows for `/v1/messages` and `/api/event_logging/batch`, but none for `security`/`.credentials.json`, `config.yaml`, or launcher environment exports. [VERIFIED: current source locations] (inference)

### Pitfall 3: Confusing "must preserve" with "must port now"

**What goes wrong:** The planner starts implementing proxy forwarding or rewriting in the new CLI milestone even when the milestone only needs reference behavior for later isolated tooling. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md] (inference)
**Why it happens:** The TypeScript backend mixes proxy, setup, auth, and launcher concerns in one repo surface. [VERIFIED: source review]
**How to avoid:** Use milestone requirements as the tie-breaker for classification: if a capability is necessary for Phases 6 to 8 deliverables, mark it `must-port`; if it is only background or parity context, mark it `reference-only`; if it belongs to multi-machine/admin flows outside the local bootstrap path, mark it `deferred`. [VERIFIED: .planning/ROADMAP.md, .planning/REQUIREMENTS.md] (inference)
**Warning signs:** A row says "important" but cannot name a future requirement or phase dependency. [VERIFIED: roadmap structure] (inference)

### Pitfall 4: Weak Boundary Verification

**What goes wrong:** Phase 5 claims legacy paths stay unchanged, but no verification step checks that claim. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md]
**Why it happens:** Documentation phases often skip regression discipline because they seem low-risk. [ASSUMED]
**How to avoid:** Add a phase-level verification step that checks changed files stay inside `.planning/` or other approved documentation paths. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md] (inference)
**Warning signs:** The plan mentions "no code changes" but has no git diff or changed-file scope check. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md] (inference)

## Code Examples

Verified patterns from the current codebase:

### Startup Sequence

```ts
const config = loadConfig(configPath)
await initOAuth(config.oauth)
startProxy(config)
```

Source: `src/index.ts`. [VERIFIED: src/index.ts]

This is the current TS runtime bootstrap order: config load, OAuth initialization, then proxy start. [VERIFIED: src/index.ts]

### Launcher Handoff to Claude

```bash
export ANTHROPIC_API_KEY="$CLIENT_TOKEN"
export ANTHROPIC_BASE_URL="$GATEWAY_URL"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_ATTRIBUTION_HEADER=false
exec claude "$@"
```

Source: `scripts/add-client.sh`. [VERIFIED: scripts/add-client.sh]

This is the clearest must-port launch contract for later CLI phases because it defines the current Claude handoff semantics. [VERIFIED: scripts/add-client.sh, .planning/ROADMAP.md] (inference)

### Proxy-Env Detection

```ts
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.ALL_PROXY ||
  process.env.all_proxy
```

Source: `src/proxy-agent.ts`. [VERIFIED: src/proxy-agent.ts]

This is the current outbound proxy capability that later bootstrap work must preserve. [VERIFIED: src/proxy-agent.ts, ENV-04 in .planning/REQUIREMENTS.md] (inference)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Refresh OAuth before expiry based on older narrative | Refresh at actual expiry with 1 second minimum delay in code and tests | Current as of the checked-in `src/oauth.ts` and `tests/oauth.test.ts` on 2026-04-08 | Inventory should trust code/tests, not the older README wording. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts] |
| Fragile launcher auth approaches using custom headers or direct OAuth handling | Client launcher exports `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, and `CLAUDE_CODE_ATTRIBUTION_HEADER=false`, then execs `claude` | Reflected in current `scripts/add-client.sh` and README changelog | Launch behavior is already codified and should be preserved as reference input for later isolated CLI work. [VERIFIED: scripts/add-client.sh, README.md] |
| Treating TS backend as just the proxy implementation | Current milestone requires inventory of runtime, setup, auth, config, and launch behavior across code and scripts | Defined in Phase 5 requirements on 2026-04-08 | Planning must include shell scripts and config contracts as first-class capability sources. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, source review] |

**Deprecated/outdated:**
- README statements that describe OAuth refresh timing differently from `src/oauth.ts` should be treated as stale for planning purposes. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts]
- Any future Phase 5 artifact that omits `tests/config.test.ts` from the validation story would be incomplete, because config semantics are already tested separately even though `npm test` does not invoke that file. [VERIFIED: package.json, tests/config.test.ts, local `npm test`, local `npx tsx tests/config.test.ts`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| None | All material factual claims in this research were verified against the current codebase, planning docs, or local environment. | All sections | Low |

## Open Questions

1. **Should the checked-in capability inventory live only under `.planning/` or also be promoted into a longer-lived `docs/` path?**
   - What we know: The phase output needs to be checked in and auditable, but the user only mandated the research file location, not the eventual inventory artifact location. [VERIFIED: user prompt, output path]
   - What's unclear: Whether later non-GSD users should consume the inventory from `.planning/` or a product-facing docs path.
   - Recommendation: Plan Phase 5 to create the canonical artifact under `.planning/phases/05...` first, then optionally mirror or summarize it later if another phase needs product-facing docs. [VERIFIED: current GSD structure] (inference)

2. **How granular should the classification matrix be for rewrite behavior?**
   - What we know: The TS backend exposes both high-level capabilities like "rewrite `/v1/messages`" and fine-grained sub-behaviors like billing-header stripping, prompt env rewriting, and base64 additional_metadata sanitation. [VERIFIED: src/rewriter.ts, tests/rewriter.test.ts]
   - What's unclear: Whether later planners need one row per endpoint, one row per rewrite family, or one row per exact mutation.
   - Recommendation: Use one row per externally meaningful capability, with a secondary notes column for sub-behaviors, so the matrix stays readable while still surfacing important detail. [VERIFIED: ANA-01, ANA-02 in .planning/REQUIREMENTS.md] (inference)

3. **Should remote-admin deployment flows be classified as `deferred` or `reference-only`?**
   - What we know: The current milestone is local-machine bootstrap and launch, and remote/self-hosted support remains a broader project constraint rather than a direct milestone requirement. [VERIFIED: .planning/PROJECT.md, .planning/ROADMAP.md]
   - What's unclear: Whether `admin-setup.sh` and multi-client distribution behavior need explicit future work in this milestone or should only remain documented background.
   - Recommendation: Default remote-admin deployment items to `deferred` unless a later phase requirement explicitly depends on them; keep purely local launcher/auth/config behaviors in `must-port` or `reference-only`. [VERIFIED: current milestone requirements] (inference)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Root TS build and tests | ✓ | `v22.19.0` | — |
| npm | Root scripts and package commands | ✓ | `10.9.3` | — |
| repo-local `tsx` | Root TS tests and dev flow | ✓ | `^4.19.0` from `package.json` | `node` + built JS, but slower and less aligned with current workflow [VERIFIED: package.json] |
| Python 3 | Shell-script JSON/YAML parsing during setup flows | ✓ | `Python 3.14.0` | None in current scripts |
| OpenSSL | Token, identity, and TLS material generation in scripts | ✓ | `OpenSSL 1.1.1t` | None in current scripts |
| macOS `security` CLI | Preferred Claude credential extraction path | ✓ | command present | Fallback to `~/.claude/.credentials.json` [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh, local command check] |

**Missing dependencies with no fallback:**
- None for Phase 5 research and validation on this machine. [VERIFIED: local environment checks]

**Missing dependencies with fallback:**
- None currently missing; the main built-in behavioral fallback is file-based credentials when Keychain lookup is unavailable or empty. [VERIFIED: scripts/quick-setup.sh, scripts/admin-setup.sh, scripts/extract-token.sh]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Root TypeScript uses direct `tsx` test scripts plus `tsc` compile verification. [VERIFIED: package.json, local `npm test`, local `npm run build`] |
| Config file | none for the root TS tests. [VERIFIED: package.json, root file inspection] |
| Quick run command | `npm test` [VERIFIED: package.json, local `npm test`] |
| Full suite command | `npm test && npx tsx tests/config.test.ts && npm run build` [VERIFIED: package.json, local `npm test`, local `npx tsx tests/config.test.ts`, local `npm run build`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANA-01 | Inventory cites real runtime, setup, auth, config, and launch behavior from source | manual review supported by existing source regression tests | `npm test && npx tsx tests/config.test.ts` | Partial |
| ANA-02 | Each capability is classified as `must-port`, `reference-only`, or `deferred` | manual/documentation validation | `none yet — Phase 5 should add a matrix completeness check or review checklist` | ❌ Wave 0 |
| ISO-01 | Legacy TS and Rust paths stay unchanged while Phase 5 adds only planning artifacts | changed-file scope check | `git diff --name-only -- . ':(exclude).planning/**'` or equivalent phase-local scope check | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test && npx tsx tests/config.test.ts`
- **Phase gate:** `npm test && npx tsx tests/config.test.ts && npm run build`, plus a changed-file scope review proving no legacy TS/Rust product paths changed. [VERIFIED: ISO-01 in .planning/REQUIREMENTS.md] (inference)

### Wave 0 Gaps

- `tests/config.test.ts` exists but is not part of `npm test`, so config inventory claims are easy to miss unless the plan adds it explicitly. [VERIFIED: package.json, tests/config.test.ts, local test runs]
- No automated check currently proves a Phase 5 inventory artifact contains required columns, source citations, and classifications. [VERIFIED: current repo inspection] (inference)
- No automated guard currently proves documentation-only phases leave `src/`, `scripts/`, and Rust product paths untouched. [VERIFIED: current repo inspection] (inference)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Inventory the current client-token auth surface in `src/auth.ts` and launcher env handoff in `scripts/add-client.sh`; do not invent a new auth contract during Phase 5. [VERIFIED: src/auth.ts, scripts/add-client.sh] |
| V3 Session Management | no | No standalone user session framework is being added in this phase; document only the existing OAuth token cache/refresh behavior. [VERIFIED: src/oauth.ts] |
| V4 Access Control | yes | Preserve current protected-vs-unprotected endpoint behavior such as `/_health` open and `/_verify` auth-gated. [VERIFIED: src/proxy.ts] |
| V5 Input Validation | yes | Reuse existing config validation behavior from `src/config.ts` as the documented baseline. [VERIFIED: src/config.ts, tests/config.test.ts] |
| V6 Cryptography | yes | Keep using existing token/id generation and OAuth handling paths; never hand-roll new secret formats in the inventory phase. [VERIFIED: src/oauth.ts, src/scripts/generate-token.ts, src/scripts/generate-identity.ts, scripts/*.sh] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage into research artifacts or logs | Information Disclosure | Inventory paths and behaviors, not raw token values; cite source locations without copying secrets. [VERIFIED: scripts/extract-token.sh, scripts/quick-setup.sh, scripts/admin-setup.sh] |
| Capability drift from stale docs | Tampering | Use source-backed citations and drift notes so later phases port live behavior, not stale narrative. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts] |
| Phase scope creep into legacy code paths | Tampering | Enforce the ISO-01 boundary with explicit changed-file checks and isolated artifact locations. [VERIFIED: .planning/REQUIREMENTS.md, .planning/ROADMAP.md] |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` - Phase requirements and milestone scope. [VERIFIED: .planning/REQUIREMENTS.md]
- `.planning/ROADMAP.md` - Phase goals, dependencies, and future phase mapping. [VERIFIED: .planning/ROADMAP.md]
- `.planning/PROJECT.md` - Milestone intent, constraints, and isolation decision. [VERIFIED: .planning/PROJECT.md]
- `package.json` - Root runtime, build, and test commands plus package versions. [VERIFIED: package.json]
- `config.example.yaml` - Current config contract exposed to operators. [VERIFIED: config.example.yaml]
- `src/index.ts`, `src/config.ts`, `src/auth.ts`, `src/oauth.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/proxy-agent.ts` - Current TS runtime behavior. [VERIFIED: source review]
- `src/scripts/generate-token.ts`, `src/scripts/generate-identity.ts` - Current helper generation behavior. [VERIFIED: source review]
- `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, `scripts/extract-token.sh`, `scripts/add-client.sh` - Current setup, credential, and launcher behavior. [VERIFIED: source review]
- `tests/config.test.ts`, `tests/oauth.test.ts`, `tests/rewriter.test.ts` - Current automated proof surface. [VERIFIED: test file review, local test runs]
- `README.md` and `docs/rust-ts-parity-checklist.md` - Supporting narrative and parity context. [VERIFIED: doc review]
- Local environment checks: `node --version`, `npm --version`, `python3 --version`, `openssl version`, `security -h`, `npm test`, `npx tsx tests/config.test.ts`, `npm run build`. [VERIFIED: local command runs on 2026-04-08]

### Secondary (MEDIUM confidence)

- None.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Derived directly from repo manifests, scripts, and local environment verification. [VERIFIED: package.json, scripts/*.sh, local version checks]
- Architecture: HIGH - Derived directly from the current TS runtime files, setup scripts, roadmap, and project constraints. [VERIFIED: source review, .planning/ROADMAP.md, .planning/PROJECT.md]
- Pitfalls: HIGH - Based on verified doc/code drift and verified test coverage gaps. [VERIFIED: README.md, src/oauth.ts, tests/oauth.test.ts, src/rewriter.ts, package.json, tests/config.test.ts]

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 for repo-local planning, or until Phase 5 source files, scripts, or milestone requirements change. [VERIFIED: current repo state] (inference)
