---
phase: 7
slug: local-environment-construction-runtime-preparation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Validation Goal

Phase 07 must prove four things together:

1. The standalone CLI can create or reuse a CLI-owned workspace and legacy-compatible bootstrap artifacts without touching protected legacy paths.
2. Re-running the prepare flow is idempotent and does not duplicate client tokens or corrupt generated config/workspace state.
3. Proxy environment settings are preserved when preparing or spawning the runtime.
4. Runtime preparation is health-gated, so Phase 8 only starts from a ready gateway session.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Direct `tsx` test scripts plus `tsc` build verification |
| **Config file** | none — package-local TypeScript build and direct `tsx` tests |
| **Quick run command** | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/environment-bootstrap.test.ts` |
| **Full suite command** | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted new Phase 7 test plus `npm --prefix standalone-cli run build`
- **After every plan wave:** Run the full standalone CLI suite for Phase 7
- **Before `/gsd-verify-work`:** `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ENV-02 | T-07-01 | First-run workspace and bootstrap manifest/config generation is deterministic and isolated | integration | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/environment-bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | ENV-03 | T-07-02 | Repeat run reuses stable identity/token/config state without duplication or corruption | integration | `npx tsx standalone-cli/tests/environment-bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | ENV-04 | T-07-03 | Proxy env precedence is preserved when preparing runtime execution | unit | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/proxy-env.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | ENV-05 | T-07-04 | Runtime prep builds/reuses the gateway, starts it with generated config, and waits for healthy readiness | integration | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/runtime-preparation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `standalone-cli/tests/environment-bootstrap.test.ts` — covers first-run generation and repeat-run idempotency for `ENV-02` and `ENV-03`
- [ ] `standalone-cli/tests/proxy-env.test.ts` — covers proxy env inheritance and precedence preservation for `ENV-04`
- [ ] `standalone-cli/tests/runtime-preparation.test.ts` — covers build/reuse path selection, process spawn, and health-gated readiness for `ENV-05`
- [ ] `standalone-cli/tests/helpers/temp-workspace.ts` or equivalent — shared temp-dir fixtures for safe manifest/config/runtime tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated workspace path is appropriate for a real local operator machine | ENV-02, ENV-03 | Final location preference depends on operator environment and home-directory layout | Run the prepare command locally, inspect the resulting workspace under the chosen `~/.ccgw/...` path, and confirm it does not touch repo-root `config.yaml` or `clients/` artifacts |
| Runtime reaches a healthy state with real credentials and local network conditions | ENV-05 | Health gating is environment-dependent and needs one real-machine smoke | On a machine with a real Claude login, run the prepare flow and confirm `/_health` reaches ready state before moving to Phase 8 launch work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
