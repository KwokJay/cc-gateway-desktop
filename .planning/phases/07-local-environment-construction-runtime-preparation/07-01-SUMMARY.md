---
phase: 07-local-environment-construction-runtime-preparation
plan: 01
subsystem: infra
tags: [typescript, cli, bootstrap, yaml, idempotency]
requires:
  - phase: 06-standalone-cli-scaffold-credential-discovery
    provides: typed secret-safe DiscoveryCredentials input for standalone bootstrap
provides:
  - CLI-owned bootstrap workspace under ~/.ccgw/standalone-cli
  - persistent manifest-backed client token and canonical identity reuse
  - deterministic legacy-compatible config.yaml rendering for rerun-safe bootstrap
affects: [07 runtime preparation, 08 claude launch, 09 validation, ENV-02, ENV-03]
tech-stack:
  added: [none]
  patterns: [manifest-driven bootstrap state, atomic local artifact writes, full config rerender on rerun]
key-files:
  created:
    - standalone-cli/src/environment/types.ts
    - standalone-cli/src/environment/workspace.ts
    - standalone-cli/src/environment/manifest.ts
    - standalone-cli/src/environment/identity.ts
    - standalone-cli/src/environment/tokens.ts
    - standalone-cli/src/environment/config-render.ts
    - standalone-cli/src/environment/bootstrap.ts
    - standalone-cli/tests/environment-bootstrap.test.ts
    - standalone-cli/tests/helpers/temp-workspace.ts
  modified: []
key-decisions:
  - "Make ~/.ccgw/standalone-cli the standalone CLI-owned workspace and reject artifact paths outside it."
  - "Use a JSON manifest as the durable source of truth, then rerender config.yaml fully on each bootstrap run."
  - "Refresh only OAuth values on rerun while keeping local client auth and canonical identity stable."
patterns-established:
  - "Package-local bootstrap tests use a fake HOME and synthetic repo-root so isolated side effects are provable."
  - "Bootstrap outputs are written atomically and returned through secret-safe summaries rather than raw token output."
requirements-completed: [ENV-02, ENV-03]
duration: 7min
completed: 2026-04-08
---

# Phase 07 Plan 01: Local Environment Construction & Runtime Preparation Summary

**Standalone CLI-owned bootstrap workspace with manifest-backed identity and token reuse plus deterministic legacy-compatible config rendering**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-08T05:28:55Z
- **Completed:** 2026-04-08T05:36:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added the environment contract types, temp-home test harness, and a package-local bootstrap integration test that locks first-run creation, rerun idempotency, OAuth-only refresh behavior, and the repo-root side-effect boundary.
- Implemented guarded workspace resolution under `~/.ccgw/standalone-cli`, atomic manifest persistence, stable token and identity generation, and full YAML config rendering from manifest state.
- Proved the standalone CLI can generate `manifest.json` and `config.yaml` without writing repo-root `config.yaml` or `clients/` artifacts, while preserving the legacy `server`, `upstream`, `oauth`, `auth`, `identity`, `env`, `prompt_env`, `process`, and `logging` sections.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write bootstrap contracts, temp-workspace helpers, and rerun tests first** - `1fda4b2` (test)
2. **Task 2: Implement workspace ownership, manifest persistence, and deterministic config rendering** - `a58d214` (feat)

## Files Created/Modified

- `standalone-cli/src/environment/types.ts` - bootstrap manifest, workspace path, and summary contracts for later runtime preparation work.
- `standalone-cli/src/environment/workspace.ts` - resolves `~/.ccgw/standalone-cli`, guards writes inside that root, and ensures the workspace exists.
- `standalone-cli/src/environment/manifest.ts` - reads and atomically writes the manifest JSON used as the durable bootstrap source of truth.
- `standalone-cli/src/environment/identity.ts` - generates canonical identity values with the existing `randomBytes(...).toString('hex')` pattern.
- `standalone-cli/src/environment/tokens.ts` - generates one stable local client token entry for auth token reuse.
- `standalone-cli/src/environment/config-render.ts` - builds and renders the legacy-compatible YAML config plus a render fingerprint.
- `standalone-cli/src/environment/bootstrap.ts` - orchestrates first-run creation versus rerun reuse and returns a secret-safe bootstrap summary.
- `standalone-cli/tests/helpers/temp-workspace.ts` - creates fake-home and fake repo-root fixtures so tests never touch the real machine or repo root.
- `standalone-cli/tests/environment-bootstrap.test.ts` - covers workspace creation, rerun idempotency, OAuth refresh replacement, and side-effect isolation.

## Decisions Made

- Chose a CLI-owned workspace rooted at `~/.ccgw/standalone-cli` so Phase 7 can preserve the legacy config contract without recreating repo-root shell side effects.
- Kept the manifest as the durable source of truth and rerendered `config.yaml` fully on each run, which prevents append-style token duplication and keeps reruns deterministic.
- Preserved the existing token and identity generation pattern from the legacy helpers with Node `crypto.randomBytes(...).toString('hex')` to stay aligned with the TypeScript reference surface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A combined `npm --prefix standalone-cli run build && npx tsx ...` verification chain hit a sandbox `tsx` IPC `EPERM` pipe-listen failure. The same build and test commands passed when rerun separately, so the code verification remained green.
- Parallel `git add` calls on the main working tree caused transient `.git/index.lock` contention. Remaining staging was rerun sequentially and completed without changing scope or content.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 07 plan 02 can build runtime preparation on top of the persisted manifest and generated config path instead of inventing a second bootstrap state model.
- Phase 08 can consume the stable client token, config path, and workspace layout when wiring Claude launch environment preparation.

## Self-Check

PASSED

- FOUND: `.planning/phases/07-local-environment-construction-runtime-preparation/07-01-SUMMARY.md`
- FOUND: `standalone-cli/src/environment/bootstrap.ts`
- FOUND: `standalone-cli/src/environment/config-render.ts`
- FOUND: `standalone-cli/tests/environment-bootstrap.test.ts`
- FOUND commit: `1fda4b2`
- FOUND commit: `a58d214`

---
*Phase: 07-local-environment-construction-runtime-preparation*
*Completed: 2026-04-08*
