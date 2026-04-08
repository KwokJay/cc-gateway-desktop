# Roadmap: CC Gateway

## Overview

Milestone v1.1 shifts the active planning focus from the earlier hardening-only roadmap to a standalone bootstrap CLI derived from the existing TypeScript backend. The CLI must inventory the TypeScript behavior it depends on, construct a local Claude Code working environment, prepare the runtime state needed for that environment, and then launch the installed `claude` executable without modifying the existing TypeScript or Rust programs.

Phase numbering continues from the prior roadmap, so this milestone begins at Phase 5.

## Phases

**Phase Numbering:**
- Integer phases (5, 6, 7): Planned milestone work
- Decimal phases (6.1, 6.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 5: TS Backend Capability Inventory** - Inventory the TypeScript backend feature surface and lock the boundary for the new standalone CLI.
- [x] **Phase 6: Standalone CLI Scaffold & Credential Discovery** - Create an isolated CLI entrypoint and detect supported local Claude credential sources safely.
- [x] **Phase 7: Local Environment Construction & Runtime Preparation** - Build or reuse bootstrap artifacts and prepare the runtime state required before launch.
- [ ] **Phase 8: Claude Launch Handoff** - Launch the installed `claude` executable through the prepared environment with full argument passthrough and failure handling.
- [ ] **Phase 9: Validation & Operator Guidance** - Add tests and operator documentation that make the new CLI repeatable and supportable.

## Phase Details

### Phase 5: TS Backend Capability Inventory
**Goal**: The repository has an auditable inventory of the TypeScript backend capabilities that the new CLI must preserve, plus a clear isolation boundary that keeps existing TS and Rust codepaths unchanged.
**Depends on**: Nothing (first phase in this milestone)
**Requirements**: ANA-01, ANA-02, ISO-01
**Success Criteria** (what must be TRUE):
  1. The TypeScript backend's runtime, setup, auth, config, and launch capabilities are documented from source files and scripts rather than assumed.
  2. Each analyzed capability is classified as must-port, reference-only, or deferred for the new CLI milestone.
  3. The milestone records an explicit boundary stating that existing TypeScript and Rust program paths remain unchanged while the new CLI is developed.
**Plans**: 2 plans
Plans:
- [x] 05-01-PLAN.md — Create the source-cited TypeScript backend capability inventory and classification matrix.
- [x] 05-02-PLAN.md — Write the explicit isolation boundary and refresh the phase validation guardrails for ISO-01.

### Phase 6: Standalone CLI Scaffold & Credential Discovery
**Goal**: An isolated new CLI surface exists and can detect supported local Claude credential sources without confusing operators or mutating legacy codepaths.
**Depends on**: Phase 5
**Requirements**: ENV-01, ISO-02
**Success Criteria** (what must be TRUE):
  1. The new CLI lives in its own path or package with its own entrypoint and operator-facing docs.
  2. The CLI checks the supported local Claude credential sources in a deterministic order and reports actionable failures when nothing usable is found.
  3. Operators can tell from the code and docs that the new CLI is additive and does not replace the existing TypeScript gateway or Rust products.
**Plans**: 2 plans
Plans:
- [x] 06-01-PLAN.md — Create the isolated `standalone-cli/` package scaffold, shared contracts, and additive operator help/docs surface.
- [x] 06-02-PLAN.md — Implement deterministic credential discovery, typed parse/error handling, and fixture-driven verification inside the isolated package.

### Phase 7: Local Environment Construction & Runtime Preparation
**Goal**: The new CLI can build or reuse the local bootstrap artifacts and runtime state needed for a gateway-backed Claude Code session.
**Depends on**: Phase 6
**Requirements**: ENV-02, ENV-03, ENV-04, ENV-05
**Success Criteria** (what must be TRUE):
  1. A first run can generate or reuse canonical identity, token, and local config or workspace artifacts without editing the existing TS or Rust applications.
  2. A repeat run safely reuses or refreshes bootstrap artifacts instead of duplicating or corrupting them.
  3. Proxy-aware settings from the local environment are preserved when the bootstrap flow prepares outbound access.
  4. The runtime state required for the generated environment is prepared before Claude launch begins.
**Plans**: 2 plans
Plans:
- [x] 07-01-PLAN.md — Create the CLI-owned workspace, manifest, and deterministic bootstrap/config-render flow with rerun-safe idempotency.
- [x] 07-02-PLAN.md — Add proxy-aware, health-gated runtime preparation and expose the Phase 7 `prepare-runtime` CLI command without launching Claude.

### Phase 8: Claude Launch Handoff
**Goal**: The new CLI launches the locally installed `claude` executable through the prepared environment with transparent argument passthrough and clear failure handling.
**Depends on**: Phase 7
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):
  1. The CLI locates the locally installed `claude` executable and launches it automatically after bootstrap succeeds.
  2. The launched process receives the required gateway-oriented environment variables without manual operator setup.
  3. Arbitrary Claude CLI arguments pass through the new CLI unchanged.
  4. Missing-`claude` or launch-execution failures stop the flow with actionable install or PATH guidance.
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md — Harden the Phase 7 runtime-prep substrate for stable repo-root, timeout, PID-ownership, and symlink-safe launch prerequisites.
- [ ] 08-02-PLAN.md — Add direct Claude handoff with exact env injection, unchanged arg passthrough, and actionable missing-command guidance.

### Phase 9: Validation & Operator Guidance
**Goal**: The new CLI is backed by automated checks and operator docs that prove first-run, repeat-run, and failure-recovery behavior.
**Depends on**: Phases 7 and 8
**Requirements**: QLT-01, QLT-02
**Success Criteria** (what must be TRUE):
  1. Automated tests cover capability inventory classification, credential detection decisions, bootstrap artifact generation, and launch environment preparation.
  2. Checked-in operator guidance explains first-run bootstrap, repeat-run behavior, and recovery for missing credentials or missing `claude`.
  3. The validation surface does not require live OAuth traffic to prove core CLI behavior.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. TS Backend Capability Inventory | 2/2 | Complete | 2026-04-08 |
| 6. Standalone CLI Scaffold & Credential Discovery | 2/2 | Complete | 2026-04-08 |
| 7. Local Environment Construction & Runtime Preparation | 2/2 | Complete | 2026-04-08 |
| 8. Claude Launch Handoff | 0/TBD | Not started | - |
| 9. Validation & Operator Guidance | 0/TBD | Not started | - |
