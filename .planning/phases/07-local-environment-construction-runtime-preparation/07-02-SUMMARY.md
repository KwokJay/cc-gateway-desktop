---
phase: 07-local-environment-construction-runtime-preparation
plan: 02
subsystem: infra
tags: [typescript, cli, proxy, runtime, health-check]
requires:
  - phase: 07-local-environment-construction-runtime-preparation
    provides: CLI-owned bootstrap workspace, manifest-backed config rendering, and rerun-safe state
provides:
  - exact proxy env precedence preservation for standalone runtime preparation
  - health-gated runtime reuse/start orchestration for the legacy TypeScript gateway
  - Phase 7 prepare-runtime command that stops at a ready local gateway
affects: [08 claude launch, 09 validation, ENV-04, ENV-05]
tech-stack:
  added: [none]
  patterns: [proxy-env preservation, adapter-driven runtime orchestration, health-gated readiness]
key-files:
  created:
    - standalone-cli/src/environment/proxy-env.ts
    - standalone-cli/src/environment/runtime.ts
    - standalone-cli/src/environment/prepare.ts
    - standalone-cli/tests/proxy-env.test.ts
    - standalone-cli/tests/runtime-preparation.test.ts
  modified:
    - standalone-cli/package.json
    - standalone-cli/src/cli.ts
    - standalone-cli/src/output.ts
    - standalone-cli/src/environment/types.ts
    - standalone-cli/tests/cli-help.test.ts
key-decisions:
  - "Reuse the existing runtime only when the stored config fingerprint matches the current rendered config and /_health is already healthy."
  - "Preserve proxy settings by copying the exact HTTPS_PROXY/https_proxy/HTTP_PROXY/http_proxy/ALL_PROXY/all_proxy precedence into the child runtime env."
  - "Keep prepare-runtime as a readiness-only command and reject passthrough arguments until Phase 8 owns claude launch behavior."
patterns-established:
  - "Standalone runtime tests inject file/build/spawn/health adapters so runtime prep can be verified without live OAuth traffic."
  - "Runtime preparation rewrites manifest runtime metadata only after a healthy gateway is confirmed via /_health."
requirements-completed: [ENV-04, ENV-05]
duration: 6min
completed: 2026-04-08
---

# Phase 07 Plan 02: Local Environment Construction & Runtime Preparation Summary

**Proxy-aware runtime preparation with manifest-safe reuse checks, build-if-missing gateway startup, and a Phase 7 prepare-runtime CLI that stops at healthy readiness**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-08T05:39:00Z
- **Completed:** 2026-04-08T05:44:48Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added red-side proxy and runtime-preparation tests that lock the legacy proxy precedence, health-gated readiness, and the no-launch Phase 7 boundary.
- Implemented standalone proxy env resolution, build-or-reuse runtime orchestration, and manifest runtime metadata updates without changing the legacy TypeScript or Rust paths.
- Exposed `prepare-runtime` through the standalone CLI with secret-safe status output and explicit rejection of Phase 8-style passthrough arguments.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write proxy and health-gated runtime tests before wiring the command surface** - `7361254` (test)
2. **Task 2: Implement proxy-env resolution, runtime orchestration, and the Phase 7 prepare-runtime command** - `5f4a0a6` (feat)

## Files Created/Modified

- `standalone-cli/tests/proxy-env.test.ts` - locks the exact uppercase/lowercase proxy precedence and no-normalization contract.
- `standalone-cli/tests/runtime-preparation.test.ts` - covers runtime reuse, stale restart, build-if-missing, health timeout, and command-surface scope boundaries.
- `standalone-cli/src/environment/proxy-env.ts` - mirrors the legacy proxy precedence contract and returns preserved proxy env keys for child runtime spawn.
- `standalone-cli/src/environment/runtime.ts` - ensures the gateway build exists, spawns `node dist/index.js <configPath>`, polls `/_health`, and distinguishes reuse from restart.
- `standalone-cli/src/environment/prepare.ts` - composes bootstrap plus runtime orchestration and persists runtime metadata back into the existing manifest contract.
- `standalone-cli/src/cli.ts` - adds `prepare-runtime` with dependency-injection hooks for tests and explicit passthrough rejection.
- `standalone-cli/src/output.ts` - renders secret-safe runtime readiness and failure summaries.
- `standalone-cli/package.json` - adds package-local `test:environment`, `test:proxy-env`, and `test:runtime` scripts.
- `standalone-cli/tests/cli-help.test.ts` - updates the help contract to the Phase 7 command surface.

## Decisions Made

- Treated runtime readiness as `/_health` success only so the standalone CLI cannot report success before OAuth-backed readiness exists.
- Reused the existing bootstrap manifest and render fingerprint instead of inventing a second runtime-state store, which preserves the Phase 7 Wave 1 contract.
- Kept runtime process env inheritance limited to the parent env plus the preserved proxy keys so outbound proxy behavior stays aligned with the legacy gateway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the CLI help contract for the new Phase 7 command surface**
- **Found during:** Task 2 (Implement proxy-env resolution, runtime orchestration, and the Phase 7 prepare-runtime command)
- **Issue:** The existing help test still asserted the Phase 6-only command surface, which would fail once `prepare-runtime` and the new verification commands were added.
- **Fix:** Updated `standalone-cli/tests/cli-help.test.ts` to assert the Phase 7 help text and verification commands.
- **Files modified:** `standalone-cli/tests/cli-help.test.ts`
- **Verification:** `npx tsx standalone-cli/tests/cli-help.test.ts`
- **Committed in:** `5f4a0a6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to keep the package-local verification surface coherent with the new Phase 7 command. No scope creep beyond the command/help contract.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 can assume the standalone CLI already has a healthy local gateway plus config path, workspace root, and runtime metadata available for launch handoff.
- Phase 9 can reuse the adapter-driven runtime tests and package-local scripts as the base validation surface for broader operator guidance and regression coverage.
- The unrelated dirty planning files remained untouched: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `.planning/config.json`.

## Self-Check

PASSED

- FOUND: `.planning/phases/07-local-environment-construction-runtime-preparation/07-02-SUMMARY.md`
- FOUND: `standalone-cli/src/environment/proxy-env.ts`
- FOUND: `standalone-cli/src/environment/runtime.ts`
- FOUND: `standalone-cli/src/environment/prepare.ts`
- FOUND: `standalone-cli/tests/proxy-env.test.ts`
- FOUND: `standalone-cli/tests/runtime-preparation.test.ts`
- FOUND commit: `7361254`
- FOUND commit: `5f4a0a6`

---
*Phase: 07-local-environment-construction-runtime-preparation*
*Completed: 2026-04-08*
