---
phase: 8
slug: claude-launch-handoff
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Validation Goal

Phase 08 must prove five things together:

1. The standalone CLI hardens the Phase 7 runtime-prep substrate enough for safe launch handoff.
2. The CLI can locate the locally installed `claude` executable and fail with actionable guidance when it is missing or not executable.
3. The launch path injects the required gateway-oriented environment variables without leaking secrets.
4. Arbitrary Claude CLI arguments pass through unchanged.
5. The command surface still preserves additive help/prepare behavior while enabling direct launch.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Direct `tsx` test scripts plus `tsc` build verification |
| **Config file** | none — package-local TypeScript build and direct `tsx` tests |
| **Quick run command** | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/claude-launch.test.ts` |
| **Full suite command** | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted new Phase 8 test plus `npm --prefix standalone-cli run build`
- **After every plan wave:** Run the full standalone CLI suite for Phase 8
- **Before `/gsd-verify-work`:** `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/credential-discovery.test.ts && npx tsx standalone-cli/tests/environment-bootstrap.test.ts && npx tsx standalone-cli/tests/proxy-env.test.ts && npx tsx standalone-cli/tests/runtime-preparation.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | RUN-04 | T-08-01 | Runtime-prep hardening prevents wrong-repo launch, hung health checks, stale PID kills, and workspace escape before launch starts | integration | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/runtime-preparation.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | RUN-01 | T-08-02 | CLI can locate `claude` or emit actionable install/PATH guidance | unit | `npx tsx standalone-cli/tests/claude-launch.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | RUN-02 | T-08-03 | Launch env injects `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, and `CLAUDE_CODE_ATTRIBUTION_HEADER=false` without leaking raw values | unit | `npx tsx standalone-cli/tests/claude-launch.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | RUN-03 | T-08-04 | Bare invocation and explicit launch paths pass arbitrary Claude args through unchanged while preserving additive help behavior | integration | `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/cli-help.test.ts && npx tsx standalone-cli/tests/claude-launch.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `standalone-cli/tests/claude-launch.test.ts` — covers executable resolution, env injection, arg passthrough, and missing-`claude` failures
- [ ] `standalone-cli/tests/helpers/launch-spy.ts` or equivalent — captures spawn args/env without launching a real `claude` process
- [ ] Phase 7 runtime-prep tests extended for repo-root resolution, request timeout, PID ownership, and symlink-aware workspace checks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive bare invocation opens a real Claude session through the prepared gateway | RUN-01, RUN-02, RUN-03 | Requires a real `claude` binary, local credentials, and operator environment | On a machine with Claude installed and valid credentials, run `ccgw-standalone-cli` and confirm it prepares the runtime then hands off to Claude with the expected gateway behavior |
| Missing-`claude` guidance is clear in a real user shell | RUN-04 | PATH and shell refresh behavior vary by operator machine | Temporarily hide `claude` from `PATH`, run the launch command, and confirm the error points to install and PATH refresh steps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
