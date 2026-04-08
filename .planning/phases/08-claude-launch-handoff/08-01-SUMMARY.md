---
phase: 08-claude-launch-handoff
plan: 01
subsystem: infra
tags: [typescript, cli, runtime, health-check, filesystem, security]
requires:
  - phase: 07-local-environment-construction-runtime-preparation
    provides: CLI-owned bootstrap workspace, manifest-backed config rendering, and health-gated runtime preparation
provides:
  - stable repo-root resolution for standalone runtime build and spawn
  - bounded per-request health polling for runtime readiness
  - runtime.json-backed ownership checks before stale PID shutdown
  - symlink-aware workspace guards for manifest, config, and runtime artifacts
affects: [08 claude launch, 08-02 plan, 09 validation, RUN-04]
tech-stack:
  added: [none]
  patterns: [package-anchored runtime resolution, per-probe readiness timeout, runtime ownership persistence, symlink-aware workspace guards]
key-files:
  created: []
  modified:
    - standalone-cli/src/environment/types.ts
    - standalone-cli/src/environment/manifest.ts
    - standalone-cli/src/environment/workspace.ts
    - standalone-cli/src/environment/runtime.ts
    - standalone-cli/src/environment/prepare.ts
    - standalone-cli/tests/environment-bootstrap.test.ts
    - standalone-cli/tests/runtime-preparation.test.ts
key-decisions:
  - "Resolve the gateway repo root from the standalone package location instead of caller cwd so launch prep cannot be redirected by invocation context."
  - "Persist runtime ownership in runtime.json and require it to match manifest state before stopping a stale PID."
  - "Bound each health probe separately so one hung request cannot silently consume the entire readiness budget."
patterns-established:
  - "Standalone runtime orchestration now fails closed when ownership cannot be proven or workspace paths traverse symlinks."
  - "Runtime-preparation tests lock package-local hardening behavior before Claude launch handoff is added."
requirements-completed: [RUN-04]
duration: 10min
completed: 2026-04-08
---

# Phase 08 Plan 01: Claude Launch Handoff Summary

**Standalone launch prep now resolves from the package-owned repo root, times out hung health probes, refuses unverified stale PID shutdown, and rejects symlink escapes in CLI workspace artifacts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-08T07:39:01Z
- **Completed:** 2026-04-08T07:48:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added red-side regression coverage for the repo-root, timeout, stale PID/runtime.json, and symlink escape failures that must stay closed before Claude handoff.
- Hardened standalone runtime preparation so build and spawn always target the real repo root, each health probe is bounded, and stale PID shutdown requires CLI-owned ownership evidence.
- Kept the hardening entirely inside `standalone-cli/` and preserved the thin Phase 8 substrate design for the upcoming direct Claude handoff work.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the Phase 7 regression surface for repo-root, timeout, PID-ownership, and symlink hardening** - `47f2950` (test)
2. **Task 2: Implement stable repo-root resolution, request timeout enforcement, runtime-ownership checks, and symlink-aware workspace guards** - `0bab1fc` (feat)

## Files Created/Modified

- `standalone-cli/tests/environment-bootstrap.test.ts` - adds symlink-aware manifest/config/runtime guard coverage.
- `standalone-cli/tests/runtime-preparation.test.ts` - locks repo-root resolution, bounded health timeout behavior, and runtime.json ownership rules.
- `standalone-cli/src/environment/types.ts` - extends runtime state and summaries with persisted ownership evidence.
- `standalone-cli/src/environment/manifest.ts` - reads and writes runtime ownership metadata in `runtime.json`.
- `standalone-cli/src/environment/workspace.ts` - rejects workspace artifact paths that escape through existing symlink segments.
- `standalone-cli/src/environment/runtime.ts` - anchors build/spawn to the package-owned repo root, bounds health probes, and gates stale PID shutdown on ownership evidence.
- `standalone-cli/src/environment/prepare.ts` - persists ownership evidence alongside manifest runtime metadata after successful preparation.

## Decisions Made

- Treated caller `cwd` as untrusted input for runtime build and spawn so launch prep always targets the intended repo root.
- Used a CLI-owned `runtime.json` file as the ownership proof for stale runtime shutdown instead of trusting manifest PID metadata alone.
- Preserved the adapter-driven runtime contract while adding timeout enforcement around each probe, which keeps tests package-local and avoids a second runtime path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the existing stale-runtime restart test to include matching ownership evidence**
- **Found during:** Task 2 (Implement stable repo-root resolution, request timeout enforcement, runtime-ownership checks, and symlink-aware workspace guards)
- **Issue:** The pre-existing restart test assumed any stale manifest PID could be stopped, which contradicted the new runtime.json ownership gate and failed once the hardening landed.
- **Fix:** Added matching ownership metadata to the existing restart scenario so it still verifies the allowed stop path while the new mismatch case covers the fail-closed branch.
- **Files modified:** `standalone-cli/tests/runtime-preparation.test.ts`
- **Verification:** `npx tsx standalone-cli/tests/runtime-preparation.test.ts`
- **Committed in:** `0bab1fc`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The adjustment was required to keep prior Phase 7 coverage consistent with the new safety contract. No scope expansion outside the planned write surface.

## Issues Encountered

- Concurrent `git add` calls intermittently produced `.git/index.lock`; staging was retried sequentially and completed without touching unrelated files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 08-02 can now treat runtime preparation as a trustworthy prerequisite for direct Claude launch handoff.
- Phase 09 can reuse the new hardening tests as part of the broader validation surface for launch behavior.
- The unrelated dirty planning files remained untouched: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `.planning/config.json`.

## Self-Check

PASSED

- FOUND: `.planning/phases/08-claude-launch-handoff/08-01-SUMMARY.md`
- FOUND: `standalone-cli/src/environment/types.ts`
- FOUND: `standalone-cli/src/environment/manifest.ts`
- FOUND: `standalone-cli/src/environment/workspace.ts`
- FOUND: `standalone-cli/src/environment/runtime.ts`
- FOUND: `standalone-cli/src/environment/prepare.ts`
- FOUND: `standalone-cli/tests/environment-bootstrap.test.ts`
- FOUND: `standalone-cli/tests/runtime-preparation.test.ts`
- FOUND commit: `47f2950`
- FOUND commit: `0bab1fc`

---
*Phase: 08-claude-launch-handoff*
*Completed: 2026-04-08*
