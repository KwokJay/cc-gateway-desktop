# Milestone Research: Features

## TypeScript Backend Capability Inventory

### Table Stakes To Preserve

- Load and validate gateway config, including canonical profile overrides and required OAuth/client-token fields
- Detect or reuse Claude OAuth credentials from local machine state
- Generate canonical identity and client token material for a local bootstrap flow
- Respect proxy environment variables for outbound access
- Prepare the launch environment for Claude Code with gateway-specific variables
- Verify that a local `claude` executable exists and surface actionable failure text when it does not

### New CLI Features Required By This Milestone

- Produce a checked-in inventory of the TypeScript backend capabilities the new CLI depends on
- Build or refresh a local working environment for Claude Code from one command
- Make repeat runs safe and idempotent
- Launch the installed `claude` binary automatically after bootstrap
- Pass arbitrary Claude CLI arguments through unchanged

### Reference-Only Behaviors

- Full reverse-proxy request forwarding and streaming response handling
- Request body/header/event rewrite internals
- Desktop control-plane supervision

These remain important reference behaviors, but the milestone request is centered on local bootstrap and launch rather than replacing the whole gateway runtime.

## Anti-Features

- Do not mutate the legacy TypeScript gateway or Rust codepaths to make the new CLI work.
- Do not require operators to hand-edit environment variables for every run.
- Do not hide missing-credential or missing-`claude` failures behind partial setup success.
