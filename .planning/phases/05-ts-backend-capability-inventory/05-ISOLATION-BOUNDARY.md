# Phase 05 Isolation Boundary

## Boundary Statement

Phase 05 is documentation-and-boundary work only for the standalone bootstrap CLI milestone.
Its purpose is to inventory the legacy TypeScript backend surface and lock the scope boundary for later isolated CLI work.
During this phase, the existing legacy TypeScript gateway, setup scripts, Rust daemon, Rust CLI, and desktop application remain unchanged.
Phase 05 does not authorize edits to legacy product paths and does not introduce standalone CLI implementation work inside those paths.

## Protected Legacy Paths

The following repository paths are protected for the standalone CLI milestone and must remain unchanged during Phase 05:

- `src/`
- `scripts/`
- `crates/core/`
- `crates/daemon/`
- `crates/cli/`
- `crates/desktop/`

These paths are retained as reference surfaces for later planning and verification.
They are not part of the allowed implementation surface for this phase.

## Allowed Phase 05 Output Paths

Phase 05 outputs are limited to the planning package under `.planning/phases/05-ts-backend-capability-inventory/`.

The approved Phase 05 deliverables are:

- `.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md`
- `.planning/phases/05-ts-backend-capability-inventory/05-ISOLATION-BOUNDARY.md`
- `.planning/phases/05-ts-backend-capability-inventory/05-VALIDATION.md`

These files are the canonical output area for this milestone's inventory and boundary contract.

## Implications For Later Phases

Later phases may add a new standalone CLI only in an isolated future path or package that is separate from the protected legacy paths above.
Any future implementation plan must preserve the current legacy TypeScript and Rust product surfaces while building the additive CLI path.
If a later phase proposes changes inside a protected legacy path, that phase must treat the change as a new scope decision rather than as permission inherited from Phase 05.
