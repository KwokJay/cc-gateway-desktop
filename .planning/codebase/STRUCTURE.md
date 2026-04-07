# Codebase Structure

**Analysis Date:** 2026-04-08

## Directory Layout

```text
[project-root]/
├── `src/`                 # Standalone TypeScript gateway reference implementation
├── `crates/`              # Rust workspace members
│   ├── `core/`            # Shared Rust auth/config/rewrite library
│   ├── `daemon/`          # Rust HTTP/TLS gateway binary
│   ├── `cli/`             # Rust `ccg` launcher/admin CLI
│   └── `desktop/`         # React frontend + Tauri desktop shell
├── `tests/`               # TypeScript parity/reference tests
├── `config/`              # Canonical profile example + JSON schema
├── `scripts/`             # Shell setup, admin, and client launcher scripts
├── `docs/`                # Local design/parity notes
├── `dist/`                # Generated TypeScript build output
├── `target/`              # Rust build output
├── `.planning/`           # Generated planning/codebase docs
├── `package.json`         # Node entry scripts for the TS gateway
├── `Cargo.toml`           # Rust workspace manifest
└── `config.example.yaml`  # Main gateway config template
```

## Directory Purposes

**`src/`:**
- Purpose: standalone Node.js gateway implementation kept as a runnable reference.
- Contains: flat utility modules plus script helpers under `src/scripts/`
- Key files: `src/index.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/config.ts`, `src/scripts/generate-identity.ts`, `src/scripts/generate-token.ts`

**`crates/core/`:**
- Purpose: reusable Rust domain layer.
- Contains: config/auth/oauth/logging modules plus rewrite submodules under `crates/core/src/rewriter/`
- Key files: `crates/core/src/lib.rs`, `crates/core/src/config.rs`, `crates/core/src/oauth.rs`, `crates/core/src/rewriter/prompt.rs`

**`crates/daemon/`:**
- Purpose: Rust HTTP server/runtime surface.
- Contains: thin binary entry and the full Axum router/proxy implementation
- Key files: `crates/daemon/src/main.rs`, `crates/daemon/src/server.rs`, `crates/daemon/tests/daemon.rs`

**`crates/cli/`:**
- Purpose: local launcher and shell integration.
- Contains: CLI command parsing, environment injection, alias management, install/uninstall helpers
- Key files: `crates/cli/src/main.rs`, `crates/cli/src/launcher.rs`, `crates/cli/src/shell.rs`, `crates/cli/src/config.rs`

**`crates/desktop/`:**
- Purpose: desktop product wrapper around the daemon.
- Contains: React UI in `crates/desktop/src/`, frontend tooling config at crate root, and native Tauri code in `crates/desktop/src-tauri/`
- Key files: `crates/desktop/src/App.tsx`, `crates/desktop/src/api.ts`, `crates/desktop/src/status/StatusTab.tsx`, `crates/desktop/src-tauri/src/commands.rs`, `crates/desktop/src-tauri/src/daemon.rs`

**`tests/`:**
- Purpose: TypeScript parity/reference test suite for the legacy gateway behavior.
- Contains: direct `tsx`-run tests and parity notes
- Key files: `tests/config.test.ts`, `tests/oauth.test.ts`, `tests/rewriter.test.ts`, `tests/parity-checklist.md`

**`config/`:**
- Purpose: canonical profile contract files consumed by config loading.
- Contains: example JSON and JSON schema
- Key files: `config/canonical-profile.example.json`, `config/canonical-profile.schema.json`

**`scripts/`:**
- Purpose: operational shell scripts for quick setup, token extraction, admin deployment, and client launcher generation.
- Contains: setup and provisioning scripts
- Key files: `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, `scripts/add-client.sh`, `scripts/extract-token.sh`

## Key File Locations

**Entry Points:**
- `src/index.ts`: TypeScript gateway startup
- `crates/daemon/src/main.rs`: Rust daemon startup
- `crates/cli/src/main.rs`: `ccg` CLI startup
- `crates/desktop/src/main.tsx`: React frontend startup
- `crates/desktop/src-tauri/src/main.rs`: Tauri shell startup

**Configuration:**
- `config.example.yaml`: main gateway config template
- `config/canonical-profile.schema.json`: canonical profile schema
- `Cargo.toml`: Rust workspace members and shared dependencies
- `package.json`: root Node scripts for the TS gateway
- `crates/desktop/vite.config.ts`: frontend build/test config
- `crates/desktop/src-tauri/tauri.conf.json`: desktop packaging/window config

**Core Logic:**
- `src/proxy.ts`: Node proxy/auth/request forwarding flow
- `src/rewriter.ts`: TypeScript request/body/header rewrite rules
- `crates/core/src/config.rs`: Rust config loading/validation
- `crates/core/src/oauth.rs`: Rust OAuth manager
- `crates/core/src/rewriter/`: Rust rewrite helpers split by concern
- `crates/daemon/src/server.rs`: Axum router and upstream proxy pipeline
- `crates/desktop/src-tauri/src/commands.rs`: Tauri command bridge
- `crates/desktop/src/status/useHealthDashboard.ts`: dashboard state derivation

**Testing:**
- `tests/*.test.ts`: TypeScript reference tests
- `crates/core/tests/config_integration.rs`: Rust config integration tests
- `crates/daemon/tests/daemon.rs`: Rust daemon integration tests
- `crates/desktop/src/status/dashboard.test.tsx`: React dashboard tests
- `crates/desktop/src/setupTests.ts`: frontend test setup

## Naming Conventions

**Files:**
- Rust modules use snake_case file names such as `crates/core/src/proxy_agent.rs` and `crates/desktop/src-tauri/src/settings.rs`.
- TypeScript gateway utility files use flat lowercase names, with hyphens for compound names such as `src/proxy-agent.ts` and `src/scripts/generate-token.ts`.
- React components use PascalCase files such as `crates/desktop/src/App.tsx`, `crates/desktop/src/status/StatusTab.tsx`, and `crates/desktop/src/status/StateMarker.tsx`.
- React hooks and non-component helpers stay camelCase or lower mixed case, for example `crates/desktop/src/status/useHealthDashboard.ts` and `crates/desktop/src/setupTests.ts`.

**Directories:**
- Runtime surfaces are grouped by product under `crates/` (`core`, `daemon`, `cli`, `desktop`).
- Desktop frontend subdirectories are feature-oriented, not layer-heavy: `crates/desktop/src/status/` and `crates/desktop/src/i18n/`.
- Top-level support directories are purpose-based: `config/`, `tests/`, `scripts/`, `docs/`.

## Where to Add New Code

**New Feature:**
- Shared gateway/auth/rewrite logic: `crates/core/src/` or a new focused module under `crates/core/src/rewriter/`
- Runtime HTTP behavior: `crates/daemon/src/server.rs` plus any extracted helper in `crates/core/src/`
- TypeScript reference behavior for parity: `src/`
- Tests: mirror the target surface in `crates/core/tests/`, `crates/daemon/tests/`, `crates/desktop/src/status/`, or root `tests/`

**New Component/Module:**
- Desktop UI component: `crates/desktop/src/` under an existing feature folder such as `crates/desktop/src/status/`, or create a sibling feature folder when the concern is not status-related
- New Tauri/native bridge module: `crates/desktop/src-tauri/src/`, then register commands in `crates/desktop/src-tauri/src/main.rs`
- New CLI behavior: `crates/cli/src/` in a file named after the concern, then wire it into `crates/cli/src/main.rs`

**Utilities:**
- Rust shared helpers: `crates/core/src/`
- TypeScript gateway helpers: `src/`
- Desktop frontend shared helpers: `crates/desktop/src/` beside the feature that owns them unless they are clearly app-wide like `crates/desktop/src/api.ts`

## Special Directories

**`dist/`:**
- Purpose: compiled TypeScript output for the root Node gateway and the desktop frontend build
- Generated: Yes
- Committed: No (`dist/` is ignored in `.gitignore`)

**`target/`:**
- Purpose: Rust build artifacts for the workspace
- Generated: Yes
- Committed: No (`target/` is ignored in `.gitignore`)

**`.planning/`:**
- Purpose: generated planning artifacts such as these codebase docs
- Generated: Yes
- Committed: No (`.planning/` is ignored in `.gitignore`)

**`docs/`:**
- Purpose: local parity and design notes such as `docs/rust-ts-parity-checklist.md`
- Generated: No
- Committed: No (`docs/` is ignored in `.gitignore`)

---

*Structure analysis: 2026-04-08*
