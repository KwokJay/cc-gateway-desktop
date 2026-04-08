---
phase: 9
slug: validation-operator-guidance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Validation Goal

Phase 09 must prove three things together:

1. The standalone CLI has a durable automated validation surface that reviewers can run from one aggregate command without live OAuth or a real `claude` subprocess.
2. The Phase 05 capability inventory contract is enforced by an automated test rather than only by planning prose.
3. Operator-facing guidance is accurate, canonical, and covers first run, repeat run, missing credentials, and missing `claude`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Direct `tsx` test scripts plus `tsc` build verification |
| **Config file** | none — package-local TypeScript build and direct `tsx` tests |
| **Quick run command** | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/operator-guidance.test.ts` |
| **Full suite command** | `npm --prefix standalone-cli run build && npm --prefix standalone-cli test && npm test && npx tsx tests/config.test.ts && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted new Phase 9 test plus `npm --prefix standalone-cli run build`
- **After every plan wave:** Run the full standalone validation suite for Phase 9
- **Before `/gsd-verify-work`:** `npm --prefix standalone-cli run build && npm --prefix standalone-cli test && npm test && npx tsx tests/config.test.ts && npm run build`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | QLT-01 | T-09-01 | Capability inventory contract and aggregate standalone test command are enforced without live OAuth | contract | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/capability-inventory.test.ts && npm --prefix standalone-cli test` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | QLT-01 | T-09-02 | Existing standalone package tests remain green under the aggregate command | integration | `npm --prefix standalone-cli test` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | QLT-02 | T-09-03 | Canonical operator guide covers first run, repeat run, missing credentials, and missing `claude` accurately | contract | `npx tsx standalone-cli/tests/operator-guidance.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | QLT-02 | T-09-04 | Repo-level standalone CLI doc is reduced to an aligned overview/pointer instead of a stale second handbook | doc contract | `npx tsx standalone-cli/tests/operator-guidance.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `standalone-cli/tests/capability-inventory.test.ts` — enforces `05-CAPABILITY-INVENTORY.md` structure, classifications, required rows, and `Known Drift`
- [ ] `standalone-cli/tests/operator-guidance.test.ts` — enforces current commands, paths, first-run/repeat-run guidance, and missing-credential / missing-`claude` recovery
- [ ] `standalone-cli/package.json` — add aggregate `test` script for reviewers and phase gates
- [ ] `standalone-cli/README.md` — expand to canonical operator runbook
- [ ] `docs/standalone-cli.md` — reduce to synced overview or pointer

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bare interactive launch works on a real operator machine | QLT-02 | Requires a real `claude` binary, local credentials, and local network conditions | On a machine with valid credentials and `claude` installed, run `ccgw-standalone-cli` and confirm the documented first-run/repeat-run/missing-command guidance matches observed behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
