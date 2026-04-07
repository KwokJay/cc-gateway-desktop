# Milestone Research: Stack

## Existing TypeScript Stack Relevant To The New CLI

- **Runtime**: Node.js 22+ with TypeScript and `tsx` for execution
- **Config parsing**: `yaml` plus Node `fs`/`path` for `config.yaml` and optional canonical profile JSON loading
- **Network behavior**: Node `https`, `http`, and `https-proxy-agent`
- **Credential bootstrap**: macOS Keychain lookup via `security`, fallback to `~/.claude/.credentials.json`, plus `python3` helpers inside shell scripts
- **Launch path**: shell scripts and Rust CLI both ultimately launch the local `claude` executable with prepared environment variables

## Recommended Stack For The New CLI

- Keep the new CLI in the existing TypeScript/Node toolchain to maximize reuse of the current setup logic and avoid adding a new dependency family.
- Prefer Node stdlib for file/process/path work so the new CLI can stay isolated and lightweight.
- Reuse the repository's existing `yaml` dependency for config generation and validation parity.
- Treat direct shell invocations (`security`, `which`, optional `claude --version`) as platform adapters behind narrow helpers.

## Integration Notes

- The new CLI should live in a new path or package and must not edit the current TypeScript gateway or Rust products.
- It can mirror behaviors from `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, and `scripts/add-client.sh`, but those scripts remain reference surfaces.
- It should preserve proxy-awareness through the existing `HTTPS_PROXY` / `HTTP_PROXY` environment conventions.

## What Not To Add

- No new long-running GUI surface.
- No database or remote service dependency.
- No forced migration of the existing Rust `ccg` command.
