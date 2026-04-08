# CC Gateway

## What This Is

CC Gateway is a privacy-preserving reverse proxy and local tooling stack for Claude Code. It routes Claude traffic through a single controllable gateway that rewrites identity, environment, prompt, and process telemetry to a canonical profile, with Rust daemon, CLI, and desktop surfaces for operators who want predictable behavior across machines.

The current codebase is a brownfield monorepo: a legacy TypeScript gateway remains as the behavioral reference while the Rust daemon, CLI, and Tauri desktop app are becoming the long-term product surface. This milestone adds a separate standalone bootstrap CLI derived from the TypeScript backend's setup and launch behaviors, without rewriting the existing TypeScript or Rust products.

## Core Value

Operators can run Claude Code through one trusted gateway that presents a stable canonical identity and does not leak surprising telemetry or operational state.

## Requirements

### Validated

- ✓ Route Claude Code through a client launcher and shared gateway token flow — existing via `crates/cli/src/launcher.rs`, `scripts/add-client.sh`, and `crates/core/src/auth.rs`
- ✓ Rewrite identity, environment, prompt, process, and selected headers before forwarding upstream — existing via `src/rewriter.ts` and `crates/core/src/rewriter/*`
- ✓ Refresh Anthropic OAuth centrally inside the gateway instead of on client machines — existing via `src/oauth.ts` and `crates/core/src/oauth.rs`
- ✓ Support canonical-profile driven configuration, outbound proxy settings, and local config files — existing via `config.example.yaml`, `src/config.ts`, and `crates/core/src/config.rs`
- ✓ Ship multiple operator surfaces (daemon, CLI, desktop) around the same gateway domain — existing via `crates/daemon/`, `crates/cli/`, and `crates/desktop/`
- ✓ Keep a checked-in, source-cited inventory of the legacy TS backend plus an explicit isolation boundary for the standalone CLI milestone — validated in Phase 5 via `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md` and `05-ISOLATION-BOUNDARY.md`
- ✓ Ship an isolated top-level `standalone-cli/` package with additive help/docs and typed credential-discovery contracts — validated in Phase 6 via `standalone-cli/` plus `.planning/phases/06-standalone-cli-scaffold-credential-discovery/VERIFICATION.md`
- ✓ Detect supported local Claude credential sources in deterministic order with typed parse failures and secret-safe output — validated in Phase 6 via `standalone-cli/src/credential-discovery/*` and `.planning/phases/06-standalone-cli-scaffold-credential-discovery/VERIFICATION.md`
- ✓ Generate or reuse a standalone CLI-owned bootstrap workspace, manifest, and legacy-compatible config without repo-root side effects — validated in Phase 7 via `standalone-cli/src/environment/bootstrap.ts` and `.planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md`
- ✓ Prepare a proxy-aware, health-gated local runtime before any Claude launch handoff — validated in Phase 7 via `standalone-cli/src/environment/proxy-env.ts`, `runtime.ts`, `prepare.ts`, and `.planning/phases/07-local-environment-construction-runtime-preparation/VERIFICATION.md`

### Active

- Launch the locally installed `claude` executable automatically after bootstrap succeeds, with the required gateway-oriented environment variables
- Keep the existing TypeScript gateway, Rust daemon, Rust CLI, and desktop app unchanged while the new CLI is developed in an isolated path
- Add verification and operator guidance for first-run bootstrap, repeat-run idempotency, and launch failure handling

### Out of Scope

- Modifying or replacing the existing TypeScript gateway, Rust daemon, Rust CLI, or desktop app in this milestone — the user explicitly wants those surfaces kept intact
- Turning the new CLI into a desktop or hosted management surface — this milestone is terminal-first local bootstrap and launch
- Supporting non-Anthropic upstream providers — the requested bootstrap flow still targets Claude Code and Anthropic credentials
- Building remote multi-user client provisioning workflows — this milestone is about one machine preparing and launching its own Claude Code environment

## Context

- The project already ships meaningful functionality and is not starting from scratch. Brownfield analysis in `.planning/codebase/` shows working launcher flows, rewrite logic, centralized OAuth handling, and multiple runtime surfaces.
- The README positions the product around telemetry control: canonical identity rewriting, billing-header stripping, prompt sanitization, and proxy-aware centralized OAuth.
- The most important implementation tension is architectural drift: `src/` still contains a runnable TypeScript gateway while `crates/core` + `crates/daemon` now hold the production-oriented path. That duplication increases parity and test burden.
- The standalone bootstrap CLI request is anchored in the existing TypeScript backend behavior, especially `src/index.ts`, `src/config.ts`, `src/proxy.ts`, `src/oauth.ts`, `src/rewriter.ts`, `scripts/quick-setup.sh`, and `scripts/add-client.sh`.
- The new milestone is not asking for another control plane rewrite. It asks for a fresh CLI surface that absorbs the useful TypeScript bootstrap and launch behaviors, prepares a local Claude Code environment, and then launches the installed `claude` binary.
- The existing Rust CLI already proves the repository wants a launcher surface, but it does not currently perform the one-shot local environment detection and construction requested here.
- Existing docs in `docs/rust-ts-parity-checklist.md` indicate parity work is ongoing and should remain a first-class planning input.

## Constraints

- **Tech stack**: Keep the existing Rust workspace, TypeScript reference implementation, and Tauri desktop stack — the repo already depends on them and packaging flows exist today
- **Compatibility**: Preserve current Claude/Anthropic request rewriting semantics while hardening the Rust-first path — behavior drift would undermine the product’s trust value
- **Security**: Avoid exposing raw OAuth tokens, client tokens, proxy credentials, or canonical identity details more broadly than necessary — these are the project’s most sensitive assets
- **Deployment**: Continue supporting both local desktop use and remote/self-hosted daemon deployments — README and scripts already promise both
- **Verification**: Default developer commands should catch regressions in config parsing, rewrite parity, and desktop status flows — current coverage gaps are too easy to miss

## Key Decisions


| Decision                                                                                       | Rationale                                                                                                                                                       | Outcome    |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Initialize as a brownfield project                                                             | Existing code, docs, and operator workflows already define the product; planning should start from reality instead of a blank slate                             | ✓ Good     |
| Treat the current planning effort as a stabilization + hardening milestone                     | The clearest repo risks are operational trust, secret handling, lifecycle safety, and parity drift, not missing greenfield feature discovery                    | — Pending  |
| Use recommended GSD defaults with planning docs committed to git                               | The user asked to proceed without friction, and committed planning artifacts make future sessions reproducible despite `.planning/` being gitignored by default | ✓ Good     |
| Keep the TypeScript gateway as a reference surface until Rust parity and coverage are explicit | Immediate deletion would be risky while parity work is still documented as active                                                                               | ⚠️ Revisit |
| Start milestone v1.1 around a standalone bootstrap CLI derived from the TypeScript backend     | The user explicitly wants the TypeScript app analyzed and a new CLI built from its core behaviors                                                               | — Pending  |
| Keep legacy TypeScript and Rust program codepaths unchanged while building the new CLI         | The new work should add an isolated surface, not destabilize the existing products                                                                              | ✓ Good     |
| Continue roadmap numbering at Phase 5 for the new milestone                                    | Preserves planning history instead of silently resetting prior roadmap numbering                                                                                | ✓ Good     |
| Use code, scripts, config, and tests as the source of truth when README narrative drifts      | Phase 5 verified multiple documentation drifts that would mislead later CLI work if README prose were treated as canonical                                     | ✓ Good     |
| Build the new CLI in a top-level `standalone-cli/` package with package-local tests and docs  | Phase 6 proved the safest additive boundary is a separate package rather than extending protected legacy paths                                                  | ✓ Good     |
| Keep credential discovery deterministic and secret-safe                                        | Phase 6 validated Keychain-first/file-fallback detection with typed parse failures and no raw token output                                                     | ✓ Good     |
| Use a CLI-owned workspace and manifest as the durable bootstrap source of truth               | Phase 7 validated idempotent reruns and legacy-compatible config rendering without recreating repo-root shell side effects                                     | ✓ Good     |
| Gate runtime readiness on `/_health` instead of process spawn alone                           | Phase 7 validated that launch handoff should only happen after a proxy-aware healthy runtime is available                                                      | ✓ Good     |


## Current Milestone: v1.1 Standalone Claude Bootstrap CLI

**Goal:** Extract the useful TypeScript backend bootstrap and launch behaviors into a new standalone CLI that can prepare a local Claude Code environment and then launch the installed `claude` executable, without changing the existing TypeScript or Rust programs.

**Target features:**

- Analyze the TypeScript backend's runtime, setup, auth, config, and launch capabilities and classify what the new CLI must preserve
- Detect local Claude Code credentials from supported sources and build the local bootstrap artifacts needed for a gateway-backed session
- Prepare or start the local runtime state needed by the bootstrap flow, then launch the installed `claude` binary automatically
- Keep the existing TypeScript gateway, Rust daemon, Rust CLI, and desktop app untouched while documenting the new CLI's boundary

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-08 after Phase 7 completion*
