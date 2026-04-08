---
phase: 09-validation-operator-guidance
plan: 02
subsystem: testing
tags: [standalone-cli, documentation, contract-tests, operator-guidance]
requires:
  - phase: 09-validation-operator-guidance
    provides: package-local aggregate standalone validation runner and capability inventory contract
provides:
  - canonical standalone operator guide in the package README
  - repo-level overview doc that delegates authority to the package README
  - executable docs contract for first run, rerun, and recovery guidance
affects:
  - standalone-cli validation surface
  - operator onboarding docs
  - future standalone package behavior changes
tech-stack:
  added: []
  patterns:
    - package-local markdown contract enforcement for operator docs
    - single-source operator guidance with repo-level pointer docs
key-files:
  created:
    - standalone-cli/tests/operator-guidance.test.ts
    - docs/standalone-cli.md
  modified:
    - standalone-cli/README.md
    - standalone-cli/tests/operator-guidance.test.ts
key-decisions:
  - "Make standalone-cli/README.md the single authoritative operator guide and keep docs/standalone-cli.md as a short overview."
  - "Enforce first run, rerun, and recovery guidance with a package-local string contract instead of relying on manual doc review."
patterns-established:
  - "Standalone operator behavior changes should update standalone-cli/README.md first, then keep docs/standalone-cli.md summary-only."
  - "Docs contracts should lock live commands, workspace paths, and secret-safe recovery wording without requiring live credentials."
requirements-completed: [QLT-02]
duration: 3min
completed: 2026-04-08
---

# Phase 09 Plan 02: Validation Operator Guidance Summary

**Canonical standalone operator runbook in `standalone-cli/README.md`, repo-level pointer docs, and executable guidance validation for first run, rerun, and recovery paths**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T09:46:25Z
- **Completed:** 2026-04-08T09:49:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `standalone-cli/tests/operator-guidance.test.ts` to lock the live command surface, workspace paths, recovery flows, and secret-safe docs contract.
- Rewrote `standalone-cli/README.md` into the canonical operator guide covering first run, repeat run behavior, workspace artifacts, and missing-credentials or missing-`claude` recovery.
- Reduced `docs/standalone-cli.md` to a short discoverability document that explicitly points readers back to the canonical package README.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a docs contract test for first run, repeat run, and recovery guidance** - `b305264` (test)
2. **Task 2: Rewrite the canonical operator guide and reduce the repo doc to an overview pointer** - `8af2260` (docs)

## Files Created/Modified

- `standalone-cli/tests/operator-guidance.test.ts` - Package-local contract that reads the README and repo doc directly and rejects stale operator guidance.
- `standalone-cli/README.md` - Canonical standalone operator runbook with first-run, rerun, workspace-artifact, and recovery guidance aligned to the live CLI surface.
- `docs/standalone-cli.md` - Thin repo-level overview that points readers to the package README instead of duplicating long-form procedure content.

## Decisions Made

- Promoted `standalone-cli/README.md` to the single authoritative runbook because the package-local doc matches the live standalone surface better than the repo-level doc.
- Kept the repo-level doc summary-only so future operator guidance drift is caught in one place instead of across competing handbooks.
- Treated documentation wording as executable contract data so guidance drift fails the same package-local validation surface as the rest of the standalone CLI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Relaxed one retry assertion to accept markdown-coded command formatting**
- **Found during:** Task 2 (Rewrite the canonical operator guide and reduce the repo doc to an overview pointer)
- **Issue:** The new docs contract required raw retry strings only, so the first verification run failed even though the README used the correct commands in backticks.
- **Fix:** Broadened the retry assertion in `standalone-cli/tests/operator-guidance.test.ts` to accept either plain-text or markdown-coded command forms while keeping the command names exact.
- **Files modified:** `standalone-cli/tests/operator-guidance.test.ts`
- **Verification:** `npx tsx standalone-cli/tests/operator-guidance.test.ts`; `npm --prefix standalone-cli test`
- **Committed in:** `8af2260` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The deviation stayed within the planned docs contract scope and made the test robust against markdown formatting without weakening the operator guidance contract.

## Issues Encountered

- `docs/` is gitignored in this repository, so `docs/standalone-cli.md` had to be staged with `git add -f` while still leaving the unrelated dirty planning files untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QLT-02` is now backed by the package-local validation surface from Wave 1, so reviewer and operator guidance drift fails `npm --prefix standalone-cli test` immediately.
- The canonical operator guide documents the current standalone package commands and paths only: `ccgw-standalone-cli`, `discover-credentials`, `prepare-runtime`, and `~/.ccgw/standalone-cli/{manifest.json,config.yaml,runtime.json}`.
- The unrelated dirty planning files `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `.planning/config.json` remained untouched during execution.

## Self-Check: PASSED

- Found `.planning/phases/09-validation-operator-guidance/09-02-SUMMARY.md`.
- Verified task commits `b305264` and `8af2260` exist in git history.
- Placeholder scan found no blocking stubs; the only `not available` match is intentional recovery guidance in `standalone-cli/README.md`.
