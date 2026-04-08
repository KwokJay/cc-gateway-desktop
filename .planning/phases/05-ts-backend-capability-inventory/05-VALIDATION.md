---
phase: 5
slug: ts-backend-capability-inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

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

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npx tsx tests/config.test.ts`
- **Before `/gsd-verify-work`:** `npm test && npx tsx tests/config.test.ts && npm run build`
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ANA-01 | T-05-01 | Inventory claims stay source-cited and evidence-backed | manual + regression support | `npm test && npx tsx tests/config.test.ts` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | ANA-02 | T-05-02 | Every capability row has an explicit classification and downstream rationale | document check | `rg -n "must-port|reference-only|deferred" .planning/phases/05-ts-backend-capability-inventory/*` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | ISO-01 | T-05-03 | Legacy TS/Rust product paths remain unchanged while Phase 5 artifacts are added | scope check | `git diff --name-only --cached HEAD~1..HEAD` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-phase-05-inventory.mjs` — validate required capability-matrix columns and allowed classification values
- [ ] `scripts/check-phase-05-scope.sh` — fail if Phase 5 touches legacy `src/`, `scripts/`, `crates/core/`, `crates/daemon/`, `crates/cli/`, or `crates/desktop/` paths

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Capability matrix covers all planning-critical TS backend areas, not just proxy logic | ANA-01 | Requires human review of category completeness against roadmap intent | Compare the inventory against `src/index.ts`, `src/config.ts`, `src/auth.ts`, `src/oauth.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/proxy-agent.ts`, `src/scripts/*.ts`, and `scripts/*.sh` |
| Classification decisions match milestone scope | ANA-02 | `must-port` vs `reference-only` vs `deferred` depends on phase intent, not only syntax | Review each row against Phase 6-9 requirements and confirm the classification rationale is stated |
| Boundary note clearly forbids legacy path edits | ISO-01 | Boundary language quality matters as much as file presence | Read the boundary artifact and confirm it explicitly protects current TS and Rust program paths |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
