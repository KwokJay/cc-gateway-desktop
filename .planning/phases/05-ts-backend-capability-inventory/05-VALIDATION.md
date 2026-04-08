---
phase: 5
slug: ts-backend-capability-inventory
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Validation Goal

Phase 05 must prove two things together:

1. The TypeScript backend capability inventory is source-backed and planning-usable.
2. The full Phase 05 deliverable set leaves protected legacy paths untouched while the standalone CLI milestone remains additive.

The required deliverable set for the phase-scoped scope review is:

- `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md`
- `.planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md`
- `.planning/phases/05-ts-backend-capability-inventory/05-VALIDATION.md`

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Root TypeScript uses direct `tsx` test scripts plus `tsc` compile verification |
| **Config file** | none for the root TS tests |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsx tests/config.test.ts && npm run build` |
| **Estimated runtime** | ~20 seconds |

---

## Required Automated Guards

| Guard | Purpose | Command | Expected Result |
|-------|---------|---------|-----------------|
| Rewriter and OAuth regression surface | Keep the current TypeScript reference behavior green while Phase 05 remains documentation-only | `npm test` | Pass |
| Config parsing regression surface | Keep config semantics visible even though `tests/config.test.ts` sits outside `npm test` | `npx tsx tests/config.test.ts` | Pass |
| Root TypeScript compile guard | Confirm the legacy TypeScript backend still builds | `npm run build` | Pass |
| Phase-scoped changed-file review | Prove ISO-01 across the full Phase 05 deliverable set rather than the working tree at large | `git add .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md .planning/phases/05-ts-backend-capability-inventory/05-VALIDATION.md` then `git diff --name-only --cached -- | rg -n '^(src/|scripts/|crates/core/|crates/daemon/|crates/cli/|crates/desktop/)'` | No output |

An equivalent Phase 05 commit-range review is acceptable only if it covers those same three deliverables and applies the same protected-path regex.

---

## Sampling Rate

- **After every task commit:** Run the task-specific document verification for the file just changed.
- **Before final plan completion:** Run `npm test`, `npx tsx tests/config.test.ts`, and `npm run build`.
- **At the Phase 05 scope gate:** Stage `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md`, `.planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md`, and `.planning/phases/05-ts-backend-capability-inventory/05-VALIDATION.md` together, then run `git diff --name-only --cached -- | rg -n '^(src/|scripts/|crates/core/|crates/daemon/|crates/cli/|crates/desktop/)'` and expect no output.
- **Max feedback latency:** 20 seconds for the root TS checks, plus the staging-based scope review.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ANA-01 | T-05-01 | Inventory claims stay source-cited and evidence-backed | manual + regression support | `npm test && npx tsx tests/config.test.ts` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | ANA-02 | T-05-02 | Every capability row has an explicit classification and downstream rationale | document check | `rg -n "must-port|reference-only|deferred" .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md` | ✅ | ✅ green |
| 05-02-01 | 02 | 2 | ISO-01 | T-05-02-01 | Boundary artifact explicitly protects legacy TS, script, Rust, and desktop paths | document check | `test -f .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md && rg -n "^## Protected Legacy Paths$|src/|scripts/|crates/core/|crates/daemon/|crates/cli/|crates/desktop/" .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md` | ✅ | ✅ green |
| 05-02-02 | 02 | 2 | ISO-01 | T-05-02-02, T-05-02-03 | Validation instructions prove scope and regression coverage without repo-root helper scripts | regression + scope review | `npm test && npx tsx tests/config.test.ts && npm run build` plus `git add .planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md .planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md .planning/phases/05-ts-backend-capability-inventory/05-VALIDATION.md` then `git diff --name-only --cached -- | rg -n '^(src/|scripts/|crates/core/|crates/daemon/|crates/cli/|crates/desktop/)'` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Capability inventory remains the planning source of truth for later CLI phases | ANA-01, ANA-02 | Requires judgment about phase usefulness, not only syntax | Review `05-CAPABILITY-INVENTORY.md` against `05-RESEARCH.md` and confirm each row still maps to a real future consumer |
| Boundary note clearly forbids legacy path edits | ISO-01 | Boundary language quality matters as much as file presence | Read `05-ISOLATION-BOUNDARY.md` and confirm it states Phase 05 is documentation-and-boundary work only and names the protected legacy paths explicitly |
| Scope review proves the full Phase 05 deliverable set stays inside the approved planning package | ISO-01 | Requires confirming the staged file set is the whole phase output under review | Stage `05-CAPABILITY-INVENTORY.md`, `05-ISOLATION-BOUNDARY.md`, and `05-VALIDATION.md` together, then confirm the protected-path grep produces no output |

---

## Validation Sign-Off

- [x] All tasks have concrete automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 dependencies removed from repo-root helper scripts
- [x] No watch-mode flags
- [x] Feedback latency remains bounded to the existing root TS checks plus a short scope review
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08
