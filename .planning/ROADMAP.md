# Roadmap: CC Gateway

## Overview

This milestone hardens an already-working CC Gateway codebase so operators can trust the Rust daemon and desktop control plane for daily use. The roadmap follows the existing brownfield risk shape: first make desktop operations and config handling trustworthy, then reduce secret exposure, then harden Rust gateway parity and request guardrails, and finally make default verification catch regressions before release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Desktop Control Plane Reliability** - Make daemon supervision, health checks, and config saves trustworthy for everyday desktop operations.
- [ ] **Phase 2: Secret-Safe Operator Surfaces** - Reduce accidental exposure of tokens, proxy details, and management data across daemon and desktop surfaces.
- [ ] **Phase 3: Rust Gateway Parity Guardrails** - Harden the Rust gateway path so rewrite behavior and request safety stay predictable.
- [ ] **Phase 4: Verification Baseline for Hardening** - Make default verification prove the hardening work across gateway, config, and desktop flows.

## Phase Details

### Phase 1: Desktop Control Plane Reliability
**Goal**: Operators can trust the desktop app to reflect real daemon state, recover from failures, and save config safely without losing the last known-good setup.
**Depends on**: Nothing (first phase)
**Requirements**: OPS-01, OPS-02, OPS-03, CFG-01, CFG-02
**Success Criteria** (what must be TRUE):
  1. Operator sees running, stopped, and crashed daemon states in the desktop dashboard that match the real managed process.
  2. Operator can start or recover the daemon from the desktop app for both HTTP and TLS local configurations without stale "running" status.
  3. Saving config from the desktop app either preserves the new valid config atomically or leaves the prior working config intact.
  4. Invalid config edits surface actionable validation errors and do not corrupt the saved config file or running daemon state.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Secret-Safe Operator Surfaces
**Goal**: Operators can inspect and manage the gateway without leaking secrets or unintentionally exposing admin-only data.
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Health and management surfaces can hide or protect upstream, client, and canonical-identity details from unauthenticated callers.
  2. The desktop UI shows redacted config and proxy values by default and only reveals raw secrets during explicit targeted edit flows.
  3. Local and desktop-first installs default to loopback-safe exposure or show a clear warning before serving plaintext gateway traffic on non-local interfaces.
  4. Operator can tell from the product surfaces when the gateway is in a locally safe mode versus a remotely exposed mode.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Rust Gateway Parity Guardrails
**Goal**: Operators can rely on the Rust daemon as the primary gateway path without rewrite drift or unsafe request buffering surprises.
**Depends on**: Phase 1
**Requirements**: GW-01, GW-02, GW-03
**Success Criteria** (what must be TRUE):
  1. Claude Code traffic routed through the Rust daemon streams successfully while identity, header, prompt, and metadata rewrites match documented parity expectations.
  2. Oversized rewrite-eligible request bodies are rejected or safely bounded instead of causing runaway memory use or unpredictable proxy behavior.
  3. Any remaining differences between the Rust and TypeScript gateways are visible through tests or compatibility documentation before operators depend on the Rust path.
**Plans**: TBD

### Phase 4: Verification Baseline for Hardening
**Goal**: Default verification catches hardening-critical regressions across config, rewrite parity, OAuth, and desktop lifecycle flows before release.
**Depends on**: Phases 1, 2, and 3
**Requirements**: QLT-01, QLT-02, QLT-03
**Success Criteria** (what must be TRUE):
  1. Running the default repository verification commands exercises config parsing, production OAuth behavior, and desktop dashboard logic without extra tribal-knowledge steps.
  2. Fixture-based parity tests catch regressions in prompt, env, header, and metadata normalization before operators ship changes.
  3. Desktop lifecycle regressions such as TLS startup, post-start crash detection, and log polling are covered by automation or checked-in manual UAT guidance.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Desktop Control Plane Reliability | 0/TBD | Not started | - |
| 2. Secret-Safe Operator Surfaces | 0/TBD | Not started | - |
| 3. Rust Gateway Parity Guardrails | 0/TBD | Not started | - |
| 4. Verification Baseline for Hardening | 0/TBD | Not started | - |
