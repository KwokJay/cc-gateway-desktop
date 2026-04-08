---
phase: 09-validation-operator-guidance
plan: 01
subsystem: testing
tags: [standalone-cli, tsx, contract-tests, validation]
requires:
  - phase: 05-ts-backend-capability-inventory
    provides: Phase 05 capability matrix and known-drift contract
  - phase: 06-standalone-cli-scaffold-credential-discovery
    provides: package-local credential discovery tests and additive CLI surface
  - phase: 07-local-environment-construction-runtime-preparation
    provides: bootstrap, proxy-env, and runtime preparation tests
  - phase: 08-claude-launch-handoff
    provides: launch handoff tests and package-local launch contract
provides:
  - package-local aggregate standalone validation runner
  - executable Phase 05 capability inventory contract test
  - canonical standalone reviewer command via npm test
affects:
  - 09-validation-operator-guidance
  - standalone-cli validation surface
  - future standalone package contract tests
tech-stack:
  added: []
  patterns:
    - deterministic package-local test enumeration
    - markdown artifact contract enforcement with Node assert
key-files:
  created:
    - standalone-cli/tests/run-all.ts
    - standalone-cli/tests/capability-inventory.test.ts
  modified:
    - standalone-cli/package.json
key-decisions:
  - "Use a package-local runner that discovers sorted *.test.ts files and excludes helpers or fixtures automatically."
  - "Treat 05-CAPABILITY-INVENTORY.md as executable contract data so capability drift fails validation immediately."
  - "Keep npm test as build plus run-all, while preserving focused test:* scripts for targeted reruns."
patterns-established:
  - "New standalone package contract tests belong in standalone-cli/tests and are auto-discovered by run-all.ts."
  - "Planning-artifact validation should rely on checked-in string contracts instead of duplicating fixtures or adding a markdown parser dependency."
requirements-completed: [QLT-01]
duration: 9min
completed: 2026-04-08
---

# Phase 09 Plan 01: Validation Operator Guidance Summary

**Aggregate standalone CLI validation command plus executable Phase 05 capability-inventory contract for package-local reviewer proof**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-08T09:34:40Z
- **Completed:** 2026-04-08T09:43:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `standalone-cli/tests/run-all.ts` to discover package-local `*.test.ts` files deterministically, exclude helpers and fixtures, and fail fast on the first contract break.
- Added `standalone-cli/tests/capability-inventory.test.ts` to enforce the Phase 05 capability matrix, allowed classifications, critical Phase 9 rows, and the `Known Drift` section from checked-in markdown.
- Wired `standalone-cli/package.json` so reviewers can run the full standalone validation surface from `npm test` while keeping the existing targeted `test:*` scripts available.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the aggregate standalone test runner and capability-inventory contract** - `5109704` (fix)
2. **Task 2: Wire package-local `npm test` to the aggregate validation surface** - `b47bbc7` (chore)

## Files Created/Modified

- `standalone-cli/tests/run-all.ts` - Deterministic package-local test harness that auto-discovers future standalone contract tests.
- `standalone-cli/tests/capability-inventory.test.ts` - String-contract guard for `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md`.
- `standalone-cli/package.json` - Canonical `npm test` entrypoint for the standalone validation surface.

## Decisions Made

- Kept the aggregate validation surface inside `standalone-cli/` so later reviewers do not need repo-root scripts or protected legacy paths.
- Enforced the Phase 05 inventory via direct markdown assertions instead of adding a new test framework or parser dependency.
- Preserved focused `test:*` scripts even after adding `npm test`, so debugging one contract remains cheap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted the aggregate test invocation to survive sandboxed verification**
- **Found during:** Task 2 (Wire package-local `npm test` to the aggregate validation surface)
- **Issue:** Initial aggregate command variants using direct `tsx` and `node --import tsx` hit sandbox-specific IPC or listener failures, blocking verification of the exact reviewer command.
- **Fix:** Kept the package-local runner generic, then wired `npm test` to `npm run build && npx tsx tests/run-all.ts`, which passed both in-package and exact `npm --prefix standalone-cli test` verification.
- **Files modified:** `standalone-cli/package.json`
- **Verification:** `cd standalone-cli && npm test`; `cd standalone-cli && npm run build && npx tsx tests/run-all.ts`; `npm --prefix standalone-cli test`
- **Committed in:** `b47bbc7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation stayed within the intended package boundary and was necessary to make the canonical reviewer command verifiable in this environment.

## Issues Encountered

- `npm --prefix standalone-cli test` needed one escalated verification run because the sandbox wrapper rejected the same script shape that passed from inside `standalone-cli/`. The code path itself was validated successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QLT-01` now has a durable package-local proof surface for capability inventory drift, credential discovery, bootstrap generation, runtime preparation, and launch handoff.
- Future standalone tests such as `standalone-cli/tests/operator-guidance.test.ts` will be picked up automatically by `run-all.ts` without another package manifest change.
- The unrelated dirty planning files `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `.planning/config.json` were left untouched.

## Self-Check: PASSED

- Found `.planning/phases/09-validation-operator-guidance/09-01-SUMMARY.md`.
- Verified task commits `5109704` and `b47bbc7` exist in git history.
