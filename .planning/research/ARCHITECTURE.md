# Milestone Research: Architecture

## Existing Architecture Inputs

- `src/index.ts` bootstraps config loading, logging, OAuth initialization, and proxy start.
- `src/config.ts` defines the config contract and canonical profile loading rules.
- `src/oauth.ts` manages token reuse, refresh, and proxy-aware network access.
- `scripts/quick-setup.sh` performs one-shot local bootstrap: credential detection, identity/token generation, config writing, launcher creation, and runtime start.
- `scripts/add-client.sh` and `crates/cli/src/launcher.rs` define the launch contract for `claude`.

## Suggested New CLI Shape

### Layer 1: Capability Inventory

- Read and codify which TypeScript backend capabilities are must-port, reference-only, or intentionally deferred.

### Layer 2: Bootstrap Detection

- Detect supported credential sources.
- Detect whether local bootstrap artifacts already exist.
- Detect whether `claude` is installed and runnable.

### Layer 3: Environment Construction

- Generate or reuse canonical identity, token, and local config/workspace files.
- Prepare proxy-aware runtime settings.
- Prepare or start the local runtime state required before Claude launch.

### Layer 4: Claude Launch Handoff

- Apply the gateway-oriented environment variables for the launched process.
- Forward operator arguments unchanged.
- Fail clearly when launch prerequisites are missing.

## Boundary Rules

- New CLI must be isolated from current TS and Rust implementations.
- Existing code remains the behavioral source of truth during milestone planning.
- Any shared logic should be copied or factored only into new files owned by the new CLI path, not by rewriting the old surfaces.
