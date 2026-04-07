# CC Gateway

## What This Is

CC Gateway is a privacy-preserving reverse proxy and local tooling stack for Claude Code. It routes Claude traffic through a single controllable gateway that rewrites identity, environment, prompt, and process telemetry to a canonical profile, with Rust daemon, CLI, and desktop surfaces for operators who want predictable behavior across machines.

The current codebase is a brownfield monorepo: a legacy TypeScript gateway remains as the behavioral reference while the Rust daemon, CLI, and Tauri desktop app are becoming the long-term product surface.

## Core Value

Operators can run Claude Code through one trusted gateway that presents a stable canonical identity and does not leak surprising telemetry or operational state.

## Requirements

### Validated

- ✓ Route Claude Code through a client launcher and shared gateway token flow — existing via `crates/cli/src/launcher.rs`, `scripts/add-client.sh`, and `crates/core/src/auth.rs`
- ✓ Rewrite identity, environment, prompt, process, and selected headers before forwarding upstream — existing via `src/rewriter.ts` and `crates/core/src/rewriter/*`
- ✓ Refresh Anthropic OAuth centrally inside the gateway instead of on client machines — existing via `src/oauth.ts` and `crates/core/src/oauth.rs`
- ✓ Support canonical-profile driven configuration, outbound proxy settings, and local config files — existing via `config.example.yaml`, `src/config.ts`, and `crates/core/src/config.rs`
- ✓ Ship multiple operator surfaces (daemon, CLI, desktop) around the same gateway domain — existing via `crates/daemon/`, `crates/cli/`, and `crates/desktop/`

### Active

- [ ] Make the Rust daemon + desktop control plane reliable enough for daily use without stale health state or fragile restart flows
- [ ] Reduce secret and deployment metadata leakage from health, config, and desktop management surfaces
- [ ] Make local configuration writes and daemon lifecycle handling safe under failure conditions
- [ ] Expand automated verification so parity-critical rewrite behavior and desktop operational paths are covered by default
- [ ] Clarify the long-term source of truth between the Rust implementation and the legacy TypeScript gateway

### Out of Scope

- Supporting non-Anthropic upstream providers in this milestone — the current product value is Claude/Anthropic-specific control and parity
- Building a hosted multi-tenant control plane or cloud dashboard — this project is currently local/self-hosted operator software
- Replacing file-based local configuration with a database-backed management service — not necessary for the current deployment model
- Mobile companion apps — not required to deliver the gateway’s core operator value

## Context

- The project already ships meaningful functionality and is not starting from scratch. Brownfield analysis in `.planning/codebase/` shows working launcher flows, rewrite logic, centralized OAuth handling, and multiple runtime surfaces.
- The README positions the product around telemetry control: canonical identity rewriting, billing-header stripping, prompt sanitization, and proxy-aware centralized OAuth.
- The most important implementation tension is architectural drift: `src/` still contains a runnable TypeScript gateway while `crates/core` + `crates/daemon` now hold the production-oriented path. That duplication increases parity and test burden.
- The desktop app is strategically important because it makes gateway operations accessible, but current codebase concerns highlight stale process state, TLS health-check mismatches, secret exposure to the renderer, and risky config-save behavior.
- Existing docs in `docs/rust-ts-parity-checklist.md` indicate parity work is ongoing and should remain a first-class planning input.

## Constraints

- **Tech stack**: Keep the existing Rust workspace, TypeScript reference implementation, and Tauri desktop stack — the repo already depends on them and packaging flows exist today
- **Compatibility**: Preserve current Claude/Anthropic request rewriting semantics while hardening the Rust-first path — behavior drift would undermine the product’s trust value
- **Security**: Avoid exposing raw OAuth tokens, client tokens, proxy credentials, or canonical identity details more broadly than necessary — these are the project’s most sensitive assets
- **Deployment**: Continue supporting both local desktop use and remote/self-hosted daemon deployments — README and scripts already promise both
- **Verification**: Default developer commands should catch regressions in config parsing, rewrite parity, and desktop status flows — current coverage gaps are too easy to miss

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Initialize as a brownfield project | Existing code, docs, and operator workflows already define the product; planning should start from reality instead of a blank slate | ✓ Good |
| Treat the current planning effort as a stabilization + hardening milestone | The clearest repo risks are operational trust, secret handling, lifecycle safety, and parity drift, not missing greenfield feature discovery | — Pending |
| Use recommended GSD defaults with planning docs committed to git | The user asked to proceed without friction, and committed planning artifacts make future sessions reproducible despite `.planning/` being gitignored by default | ✓ Good |
| Keep the TypeScript gateway as a reference surface until Rust parity and coverage are explicit | Immediate deletion would be risky while parity work is still documented as active | ⚠️ Revisit |

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
*Last updated: 2026-04-08 after initialization*
