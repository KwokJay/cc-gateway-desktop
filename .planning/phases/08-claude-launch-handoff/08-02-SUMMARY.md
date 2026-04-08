---
phase: 08-claude-launch-handoff
plan: 02
subsystem: infra
tags: [typescript, cli, runtime, child-process, launch, testing]
requires:
  - phase: 08-claude-launch-handoff
    provides: hardened runtime-prep substrate with stable repo-root resolution, health timeout enforcement, runtime ownership checks, and symlink-aware workspace guards
provides:
  - direct standalone CLI handoff to the locally installed claude executable
  - exact legacy gateway launch env injection through the package-local manifest/runtime state
  - additive help, README, and test script coverage for the new launch surface
affects: [09 validation, RUN-01, RUN-02, RUN-03, RUN-04, standalone launch UX]
tech-stack:
  added: [none]
  patterns: [prepare-then-launch handoff, direct spawn with shell false, package-local launch spy verification]
key-files:
  created:
    - standalone-cli/src/launch/claude.ts
    - standalone-cli/tests/claude-launch.test.ts
    - standalone-cli/tests/helpers/launch-spy.ts
  modified:
    - standalone-cli/package.json
    - standalone-cli/README.md
    - standalone-cli/src/cli.ts
    - standalone-cli/src/output.ts
    - standalone-cli/tests/cli-help.test.ts
key-decisions:
  - "Treat bare invocation and non-command argv as the same prepare-then-launch path so the standalone CLI cannot drift between explicit and passthrough launch modes."
  - "Derive ANTHROPIC_API_KEY from the CLI-owned manifest and ANTHROPIC_BASE_URL from prepared runtime health state instead of introducing a second bootstrap or launch state store."
  - "Keep the Claude handoff as a direct child-process spawn with shell disabled so argv passthrough remains exact and shell injection risk stays out of scope."
patterns-established:
  - "Phase 8 launch tests use a package-local spawn spy plus dependency injection rather than a live claude binary."
  - "Standalone launch failures now report install and PATH guidance without printing a false success banner."
requirements-completed: [RUN-01, RUN-02, RUN-03, RUN-04]
duration: 8min
completed: 2026-04-08
---

# Phase 08 Plan 02: Claude Launch Handoff Summary

**Direct standalone Claude handoff now reuses the hardened runtime-prep path, injects the legacy gateway env contract, preserves argv fidelity, and fails with actionable install/PATH guidance**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-08T07:50:00Z
- **Completed:** 2026-04-08T07:58:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a red-side launch contract with a package-local spawn spy plus tests for env injection, bare invocation, passthrough argv fidelity, and missing-command guidance.
- Implemented direct `claude` handoff inside `standalone-cli/` by reusing credential discovery and runtime preparation, then deriving the launch env from the existing manifest and runtime summary.
- Updated the standalone help, README, and package scripts so the additive Phase 8 launch surface is documented and verifiable without touching legacy TypeScript, Rust, or desktop paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write launch-spy and CLI launch tests for resolution, env injection, passthrough, and missing-command handling** - `27f6ea2` (test)
2. **Task 2: Implement direct Claude handoff, additive help/docs updates, and package-local launch verification wiring** - `e1b7b45` (feat)

## Files Created/Modified

- `standalone-cli/tests/helpers/launch-spy.ts` - package-local spawn spy that captures command, args, env, cwd, and error/exit outcomes without a real Claude binary.
- `standalone-cli/tests/claude-launch.test.ts` - locks direct spawn semantics, env injection, bare invocation, passthrough argv fidelity, and missing-command guidance.
- `standalone-cli/tests/cli-help.test.ts` - advances the help contract to explicit Phase 8 help commands while bare invocation becomes the launch path.
- `standalone-cli/src/launch/claude.ts` - builds the exact launch env contract and spawns `claude` directly with inherited stdio and shell disabled.
- `standalone-cli/src/cli.ts` - routes bare invocation and non-command argv through discover → prepare → manifest read → launch.
- `standalone-cli/src/output.ts` - renders the additive Phase 8 help surface and actionable launch failure guidance.
- `standalone-cli/package.json` - adds the package-local `test:launch` verification command.
- `standalone-cli/README.md` - documents direct launch handoff, env injection, and package-local verification commands.

## Decisions Made

- Used `summary.bootstrap.workspacePaths` plus the existing manifest reader to recover the client token after runtime prep rather than adding a second handoff store.
- Kept `prepare-runtime` as an explicit readiness-only command while making bare invocation and passthrough args the direct Claude launch surface.
- Returned Claude's exit code from the direct handoff path while reserving actionable guidance for missing-command and non-executable launch failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the help test to stop treating bare invocation as a help command**
- **Found during:** Task 2 (Implement direct Claude handoff, additive help/docs updates, and package-local launch verification wiring)
- **Issue:** The existing help test still asserted `ccgw-standalone-cli` rendered help, which blocked the new Phase 8 bare-launch behavior and caused the test to execute the real launch path.
- **Fix:** Narrowed the explicit help assertions to `help`, `-h`, and `--help` so bare invocation remains reserved for prepare-and-launch behavior.
- **Files modified:** `standalone-cli/tests/cli-help.test.ts`
- **Verification:** `npx tsx standalone-cli/tests/cli-help.test.ts`
- **Committed in:** `e1b7b45`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The adjustment aligned the pre-existing help test with the planned Phase 8 launch semantics. No scope expansion beyond the package-local verification surface.

## Issues Encountered

- Parallel `git add` calls intermittently produced `.git/index.lock`; staging was retried sequentially and completed without touching unrelated files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 09 can validate the real interactive launch flow on a machine with a local Claude install and live credentials instead of building more launch plumbing.
- The hardened Wave 1 runtime-prep substrate remained intact; Phase 8 only layered the direct handoff and launch-facing docs/tests on top of it.
- The unrelated dirty planning files remained untouched during execution: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `.planning/config.json`.

## Self-Check

PASSED

- FOUND: `.planning/phases/08-claude-launch-handoff/08-02-SUMMARY.md`
- FOUND: `standalone-cli/src/launch/claude.ts`
- FOUND: `standalone-cli/tests/claude-launch.test.ts`
- FOUND: `standalone-cli/tests/helpers/launch-spy.ts`
- FOUND commit: `27f6ea2`
- FOUND commit: `e1b7b45`

---
*Phase: 08-claude-launch-handoff*
*Completed: 2026-04-08*
