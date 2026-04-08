---
phase: 6
slug: standalone-cli-scaffold-credential-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Validation Goal

Phase 06 must prove two things together:

1. The new standalone CLI scaffold is isolated in its own package with its own entrypoint, docs, and tests.
2. Credential discovery is deterministic, additive, and testable without requiring live local Claude credentials.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Direct TypeScript test files executed with `tsx` plus `tsc` compile verification |
| **Config file** | none — package-local TypeScript build and direct test entry files |
| **Quick run command** | `npx tsx standalone-cli/tests/credential-discovery.test.ts` |
| **Full suite command** | `npm test && npx tsx tests/config.test.ts && npm run build && npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/credential-discovery.test.ts` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx standalone-cli/tests/credential-discovery.test.ts`
- **After every plan wave:** Run `npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/credential-discovery.test.ts`
- **Before `/gsd-verify-work`:** `npm test && npx tsx tests/config.test.ts && npm run build && npm --prefix standalone-cli run build && npx tsx standalone-cli/tests/credential-discovery.test.ts`
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ISO-02 | T-06-01 | Isolated package scaffold exists outside protected legacy paths | build + file-contract | `test -f standalone-cli/package.json && test -f standalone-cli/tsconfig.json && test -f standalone-cli/src/index.ts && npm --prefix standalone-cli run build` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | ISO-02 | T-06-02 | Additive docs and help text state the new CLI does not replace legacy TS/Rust surfaces | doc/help check | `npx tsx standalone-cli/tests/cli-help.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | ENV-01 | T-06-03 | Credential discovery checks macOS Keychain first, then `~/.claude/.credentials.json`, with actionable failures | unit | `npx tsx standalone-cli/tests/credential-discovery.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | ENV-01 | T-06-04 | No live secrets are required for core verification; malformed JSON is distinct from “not found” | unit | `npx tsx standalone-cli/tests/credential-discovery.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `standalone-cli/tests/credential-discovery.test.ts` — fixture-driven credential-source order and error-category coverage for `ENV-01`
- [ ] `standalone-cli/tests/cli-help.test.ts` — additive/help-surface coverage for `ISO-02`
- [ ] `standalone-cli/package.json` — package-local build script for the isolated CLI scaffold

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scaffold is visibly additive and not confused with the Rust `ccg` launcher | ISO-02 | Naming and adoption clarity require human judgment | Read `standalone-cli/README.md` and `--help` output; confirm both state the package is additive and does not replace existing TS/Rust surfaces |
| Live credential discovery can succeed on a machine with a real Claude login | ENV-01 | This machine currently lacks both Keychain and file credential sources, so automated tests must stay fixture-driven | On a machine with Claude Code login, run the new CLI and confirm source order and actionable output match the documented contract |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
