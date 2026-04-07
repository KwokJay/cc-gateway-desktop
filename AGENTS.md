<!-- GSD:project-start source:PROJECT.md -->
## Project

**CC Gateway**

CC Gateway is a privacy-preserving reverse proxy and local tooling stack for Claude Code. It routes Claude traffic through a single controllable gateway that rewrites identity, environment, prompt, and process telemetry to a canonical profile, with Rust daemon, CLI, and desktop surfaces for operators who want predictable behavior across machines.

The current codebase is a brownfield monorepo: a legacy TypeScript gateway remains as the behavioral reference while the Rust daemon, CLI, and Tauri desktop app are becoming the long-term product surface.

**Core Value:** Operators can run Claude Code through one trusted gateway that presents a stable canonical identity and does not leak surprising telemetry or operational state.

### Constraints

- **Tech stack**: Keep the existing Rust workspace, TypeScript reference implementation, and Tauri desktop stack — the repo already depends on them and packaging flows exist today
- **Compatibility**: Preserve current Claude/Anthropic request rewriting semantics while hardening the Rust-first path — behavior drift would undermine the product’s trust value
- **Security**: Avoid exposing raw OAuth tokens, client tokens, proxy credentials, or canonical identity details more broadly than necessary — these are the project’s most sensitive assets
- **Deployment**: Continue supporting both local desktop use and remote/self-hosted daemon deployments — README and scripts already promise both
- **Verification**: Default developer commands should catch regressions in config parsing, rewrite parity, and desktop status flows — current coverage gaps are too easy to miss
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Rust (edition 2021) - production gateway, shared rewriting core, CLI, and Tauri backend in `Cargo.toml`, `crates/core/`, `crates/daemon/`, `crates/cli/`, and `crates/desktop/src-tauri/`.
- TypeScript (5.x) - legacy/prototype gateway and desktop frontend in `src/`, `tests/`, `tsconfig.json`, and `crates/desktop/src/`.
- Bash - setup, deployment, and client-launcher generation in `scripts/add-client.sh`, `scripts/admin-setup.sh`, `scripts/quick-setup.sh`, and `scripts/extract-token.sh`.
- YAML and JSON - runtime configuration and canonical profile contracts in `config.example.yaml`, `config/canonical-profile.example.json`, `config/canonical-profile.schema.json`, and `crates/desktop/src-tauri/tauri.conf.json`.
## Runtime
- Node.js 22+ - root gateway prototype and setup scripts are designed around Node in `README.md`, `Dockerfile`, and `package.json`.
- Tokio 1.36 - async runtime for Rust gateway and OAuth refresh loops in `Cargo.toml`, `crates/daemon/src/main.rs`, and `crates/core/src/oauth.rs`.
- Tauri 2.0 - desktop runtime, tray integration, autostart, and command bridge in `crates/desktop/src-tauri/Cargo.toml` and `crates/desktop/src-tauri/src/main.rs`.
- npm - root JavaScript/TypeScript toolchain in `package.json`.
- Lockfile: present at `package-lock.json`.
- npm - desktop frontend toolchain in `crates/desktop/package.json`.
- Lockfile: present at `crates/desktop/package-lock.json`.
- Cargo - Rust workspace management in `Cargo.toml`.
- Lockfile: present at `Cargo.lock`.
## Frameworks
- Axum 0.7 + Hyper + Tower - Rust HTTP proxy implementation in `Cargo.toml` and `crates/daemon/src/server.rs`.
- Tauri 2.0 - desktop shell and native command surface in `crates/desktop/src-tauri/Cargo.toml` and `crates/desktop/src-tauri/src/main.rs`.
- React 18 + Vite 5 - desktop UI in `crates/desktop/package.json`, `crates/desktop/src/main.tsx`, and `crates/desktop/vite.config.ts`.
- Node built-in `http`/`https` - TypeScript gateway server in `src/proxy.ts`.
- Dual implementation pattern - the repo carries both a Node gateway in `src/index.ts` and a Rust gateway in `crates/daemon/src/main.rs`, with shared canonical-profile semantics mirrored in `src/config.ts` and `crates/core/src/config.rs`.
- Root TypeScript tests run through `tsx` commands defined in `package.json` and located in `tests/config.test.ts`, `tests/oauth.test.ts`, and `tests/rewriter.test.ts`.
- Vitest 1 + Testing Library - desktop component tests in `crates/desktop/vitest.config.ts`, `crates/desktop/src/test/setup.ts`, and `crates/desktop/src/status/dashboard.test.tsx`.
- Cargo test - Rust unit and integration coverage supported by manifests in `crates/core/Cargo.toml`, `crates/daemon/Cargo.toml`, and `crates/cli/Cargo.toml`.
- TypeScript compiler 5.7 - root build in `package.json` and `tsconfig.json`.
- TypeScript compiler 5.3 - desktop frontend build in `crates/desktop/package.json` and `crates/desktop/tsconfig.json`.
- `tsx` - root watch/dev workflow in `package.json`.
- Tailwind CSS 3.4 + PostCSS + Autoprefixer - desktop styling in `crates/desktop/tailwind.config.js` and `crates/desktop/postcss.config.js`.
- `tauri-build` - native bundle build hook in `crates/desktop/src-tauri/build.rs`.
- Docker multi-stage Node 22 image - containerized prototype deployment in `Dockerfile`.
## Key Dependencies
- `reqwest` 0.11 - upstream proxying and OAuth refresh in `Cargo.toml`, `crates/daemon/src/server.rs`, and `crates/core/src/oauth.rs`.
- `axum-server` 0.7 with `tls-rustls` - optional TLS listener in `crates/daemon/Cargo.toml` and `crates/daemon/src/server.rs`.
- `serde`, `serde_yaml`, and `serde_json` - Rust config/canonical-profile loading in `crates/core/src/config.rs`.
- `yaml` 2.7 - TypeScript config parsing in `src/config.ts`.
- `https-proxy-agent` 9 - outbound proxy support for the TypeScript gateway in `src/proxy-agent.ts`.
- `@tauri-apps/api`, `@tauri-apps/plugin-shell`, and `@tauri-apps/plugin-notification` - desktop/native bridge in `crates/desktop/package.json`, `crates/desktop/src/api.ts`, `crates/desktop/src/App.tsx`, and `crates/desktop/src/status/notifications.ts`.
- `i18next` and `react-i18next` - desktop localization in `crates/desktop/src/i18n/index.ts`.
- `tracing`, `tracing-subscriber`, and `tracing-appender` - Rust logging in `Cargo.toml` and `crates/core/src/logger.rs`.
- `clap` 4.5 - CLI command parsing in `Cargo.toml` and `crates/cli/src/main.rs`.
- `regex`, `sha2`, and `base64` - prompt/env rewriting internals in `crates/core/src/rewriter/prompt.rs` and `crates/core/src/rewriter/env.rs`.
- `lucide-react` - desktop icon set in `crates/desktop/src/App.tsx` and `crates/desktop/src/status/StateMarker.tsx`.
- `webdriverio` is listed in `crates/desktop/package.json`, but no first-party usage was detected under `crates/desktop/src/`.
## Configuration
- Gateway server config is YAML loaded by `src/config.ts` and `crates/core/src/config.rs`; start from `config.example.yaml`.
- Optional canonical profile JSON is loaded via `canonical_profile_path` from `config/canonical-profile.example.json` and validated against `config/canonical-profile.schema.json`.
- Desktop defaults expect the daemon config at `~/.ccgw/config.yaml`, resolved in `crates/desktop/src-tauri/src/daemon.rs`.
- CLI client config lives at `~/.config/cc-gateway/config.json`, with env fallback in `crates/cli/src/config.rs`.
- Desktop settings persist to `~/.ccgw/desktop-settings.json` in `crates/desktop/src-tauri/src/settings.rs`.
- Desktop logs persist to `~/.ccgw/logs/desktop-daemon.log` through `crates/desktop/src-tauri/src/daemon.rs`.
- Root TS build config: `tsconfig.json`.
- Desktop TS build config: `crates/desktop/tsconfig.json` and `crates/desktop/tsconfig.node.json`.
- Desktop dev/build pipeline: `crates/desktop/vite.config.ts`.
- Desktop test config: `crates/desktop/vitest.config.ts`.
- Native desktop packaging: `crates/desktop/src-tauri/tauri.conf.json`.
- Container build/runtime: `Dockerfile` and `docker-compose.yml`.
## Platform Requirements
- Node.js 22+ is the expected JavaScript runtime for the root gateway and scripts in `README.md` and `Dockerfile`.
- A Rust toolchain capable of building the workspace members in `Cargo.toml` is required for the daemon, CLI, and desktop app.
- The `claude` binary must exist in `PATH` for launcher-based flows in `crates/cli/src/launcher.rs` and `scripts/add-client.sh`.
- macOS-oriented setup tooling is built in: scripts call `security` and reference Claude local credentials in `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, and `scripts/extract-token.sh`.
- The Rust daemon binds `0.0.0.0:<port>` with optional Rustls TLS in `crates/daemon/src/server.rs`.
- Container deployment is supported through `Dockerfile` and `docker-compose.yml`.
- Desktop distribution targets `dmg` and `nsis` bundles via `crates/desktop/src-tauri/tauri.conf.json`.
- The Tauri desktop app expects a `ccgw-daemon` binary either at `target/debug/ccgw-daemon` or on `PATH`, as checked in `crates/desktop/src-tauri/src/daemon.rs`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Follow the local package style instead of forcing one repo-wide style.
- Gateway Node/TS files under `src/` use lowercase or kebab-case names such as `src/config.ts`, `src/proxy-agent.ts`, and `src/scripts/generate-token.ts`.
- React component files under `crates/desktop/src/` use PascalCase when they export a component, for example `crates/desktop/src/App.tsx`, `crates/desktop/src/status/StatusTab.tsx`, and `crates/desktop/src/status/StateMarker.tsx`.
- React hooks and helpers use camelCase file names, for example `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/api.ts`, and `crates/desktop/src/status/notifications.ts`.
- Rust modules use snake_case file names such as `crates/core/src/oauth.rs`, `crates/daemon/src/server.rs`, and `crates/desktop/src-tauri/src/settings.rs`.
- Use camelCase in TypeScript for functions and helpers: `loadConfig` in `src/config.ts`, `rewriteBody` in `src/rewriter.ts`, `fileTarget` in `crates/desktop/src/App.tsx`, and `notifyDanger` in `crates/desktop/src/status/notifications.ts`.
- Use snake_case in Rust for functions and methods: `build_state` in `crates/daemon/src/server.rs`, `prepare_launch_env` in `crates/cli/src/launcher.rs`, and `save_to_path` in `crates/desktop/src-tauri/src/settings.rs`.
- Use camelCase for local TS variables: `configPath` in `src/index.ts`, `oauthState` in `crates/desktop/src/status/useHealthDashboard.ts`, and `selectedCategory` in `crates/desktop/src/status/StatusTab.tsx`.
- Keep external-contract fields in snake_case when they mirror YAML/JSON payloads, for example `canonical_profile_path`, `device_id`, `account_uuid`, and `expires_at` in `src/config.ts`.
- Use `SCREAMING_SNAKE_CASE` for module constants: `TOKEN_URL`, `CLIENT_ID`, and `DEFAULT_SCOPES` in `src/oauth.ts`; `MIN_REFRESH_DELAY` and `RETRY_DELAY` in `crates/core/src/oauth.rs`.
- Use PascalCase for TS types and interfaces: `Config`, `CanonicalProfile` in `src/config.ts`; `ConfigSummary`, `DesktopSettings`, and `PromptEnvSummary` in `crates/desktop/src/api.ts`.
- Use PascalCase for Rust structs/enums and pair them with serde rename rules at boundaries, for example `ConfigSummary` with `#[serde(rename_all = "camelCase")]` in `crates/desktop/src-tauri/src/commands.rs` and `OAuthConfig` with `#[serde(rename_all = "snake_case")]` in `crates/core/src/config.rs`.
## Code Style
- No ESLint, Prettier, or Biome config is present at the repo root or in `crates/desktop/`.
- TypeScript style is package-local:
- Rust follows standard rustfmt-style layout; no custom `rustfmt.toml` is detected.
- No explicit linter configuration is detected.
- Type safety is enforced mainly through strict compiler settings:
## Import Organization
- Gateway TS keeps Node built-ins before local modules, for example `src/proxy.ts`.
- Desktop TS keeps third-party UI/runtime imports first, then side-effect imports, then local modules, for example `crates/desktop/src/App.tsx` and `crates/desktop/src/status/StatusTab.tsx`.
- Rust groups imports as standard library, third-party crates, then `crate::...` or workspace crate imports, for example `crates/core/src/oauth.rs` and `crates/daemon/src/server.rs`.
- No TS path aliases are configured. Use relative imports.
- Root runtime TS uses explicit emitted-extension imports (`'./config.js'`, `'./logger.js'`).
- Desktop React TS uses extensionless relative imports (`'./StatusTab'`, `'../api'`).
## Error Handling
- Throw detailed validation errors near parsing boundaries in `src/config.ts`; the strings are meant to be user-actionable.
- Wrap process entrypoints in one top-level failure handler, for example `src/index.ts` and `crates/daemon/src/main.rs`.
- Use best-effort `try/catch` around rewrite or UI-side effects when failure should degrade instead of crash, for example `src/rewriter.ts`, `src/proxy.ts`, and `crates/desktop/src/status/notifications.ts`.
- In Rust, prefer typed errors for config parsing (`ConfigError` in `crates/core/src/config.rs`) and `anyhow::Result` plus `.context(...)` for command/server orchestration (`crates/cli/src/main.rs`, `crates/daemon/src/server.rs`).
- Preserve transport contracts at TS/Rust boundaries with serde rename attributes instead of ad-hoc field mapping, for example `crates/desktop/src-tauri/src/commands.rs`.
## Logging
- Use `log(level, message, extra?)` and `audit(...)` from `src/logger.ts` instead of raw `console.log` in gateway runtime code.
- Gateway request flow logs method/path/client in `src/proxy.ts`.
- Rust services log structured lifecycle and error events with `info!`, `warn!`, and `error!` in `crates/daemon/src/server.rs` and `crates/core/src/logger.rs`.
- Desktop UI logs only operational failures that are not surfaced as inline state, for example `console.error('Health check failed', healthErr);` in `crates/desktop/src/App.tsx`.
## Comments
- Comments explain protocol semantics, safety constraints, and ordered rewrite steps rather than obvious code.
- Examples:
- Used selectively for behavior-heavy exported helpers such as `initOAuth` in `src/oauth.ts`, `rewriteBody` in `src/rewriter.ts`, and `notifyDanger` in `crates/desktop/src/status/notifications.ts`.
- Most internal helpers rely on naming plus short inline comments instead of full docblocks.
## Function Design
- `rewriteBody` in `src/rewriter.ts` dispatches to `rewriteMessagesBody`, `rewriteEventBatch`, and `rewriteGenericIdentity`.
- `useHealthDashboard` in `crates/desktop/src/status/useHealthDashboard.ts` builds data via small pure helper closures such as `buildChecksCategory` and `resultItem`.
- `run` in `crates/daemon/src/server.rs` delegates setup to `build_state`, `router`, and `log_startup`.
- Pass typed config/state objects instead of long primitive lists, for example `rewriteBody(body, path, config)` in `src/rewriter.ts` and `build_config_summary(config)` in `crates/desktop/src-tauri/src/commands.rs`.
- Prefer explicit string unions for UI/runtime state, for example `DaemonStatus` in `crates/desktop/src/App.tsx` and `HealthState` in `crates/desktop/src/status/types.ts`.
- TS runtime helpers return concrete values or `null` for degraded states, for example `getAccessToken(): string | null` in `src/oauth.ts`.
- Rust returns `Result<T, E>` nearly everywhere at IO/network boundaries.
## Module Design
- Prefer named exports in runtime TS (`src/config.ts`, `src/logger.ts`, `src/rewriter.ts`) and desktop helpers (`crates/desktop/src/api.ts`, `crates/desktop/src/status/notifications.ts`).
- Default exports are limited to app bootstrap modules such as `crates/desktop/src/App.tsx` and `crates/desktop/src/i18n/index.ts`.
- Rust uses `lib.rs` re-exports to define the crate surface, especially `crates/core/src/lib.rs`.
- No TS barrel-file pattern is used.
- `crates/core/src/lib.rs` acts as the Rust barrel/re-export surface for the shared core crate.
- Keep snake_case for config/proxy payload fields in `src/` and `crates/core/`.
- Keep camelCase for data sent into the desktop React layer, backed by `#[serde(rename_all = "camelCase")]` in `crates/desktop/src-tauri/src/commands.rs`.
- Keep UI text routed through `useTranslation()` and locale JSON files in `crates/desktop/src/i18n/` instead of hardcoded component strings.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Shared Rust domain logic is centralized in `crates/core/src/` and reused by `crates/daemon/src/`, `crates/cli/src/`, and `crates/desktop/src-tauri/src/`.
- `src/` remains a runnable Node.js gateway and the behavior reference used by parity notes in `docs/rust-ts-parity-checklist.md` and parity tests in `tests/`.
- The desktop product is split into a React/Vite frontend in `crates/desktop/src/` and a Tauri/native backend in `crates/desktop/src-tauri/src/`.
## Layers
- Purpose: runnable Node prototype and reference behavior for auth, OAuth, request rewriting, and proxy forwarding.
- Location: `src/`
- Contains: `src/index.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/config.ts`, `src/oauth.ts`, `src/auth.ts`
- Depends on: Node stdlib, `yaml`, `https-proxy-agent`
- Used by: root `package.json` scripts, root `tests/*.test.ts`, and parity comparisons against Rust code
- Purpose: reusable config parsing, token auth, OAuth refresh, logging, and payload/header rewrite primitives.
- Location: `crates/core/src/`
- Contains: `crates/core/src/config.rs`, `crates/core/src/auth.rs`, `crates/core/src/oauth.rs`, `crates/core/src/logger.rs`, `crates/core/src/rewriter/*.rs`
- Depends on: `serde`, `reqwest`, `http`, `chrono`, `regex`, `base64`, `rand`, `sha2`
- Used by: `crates/daemon/src/server.rs`, `crates/desktop/src-tauri/src/commands.rs`, and any future Rust runtime surface
- Purpose: the production-style HTTP/TLS reverse proxy that accepts client traffic and forwards it upstream.
- Location: `crates/daemon/src/`
- Contains: `crates/daemon/src/main.rs`, `crates/daemon/src/server.rs`
- Depends on: `ccgw-core`, `axum`, `axum-server`, `reqwest`
- Used by: direct daemon runs and desktop process supervision in `crates/desktop/src-tauri/src/daemon.rs`
- Purpose: local `ccg` launcher that injects gateway env vars, installs/uninstalls the binary, manages shell aliases, and checks daemon health.
- Location: `crates/cli/src/`
- Contains: `crates/cli/src/main.rs`, `crates/cli/src/launcher.rs`, `crates/cli/src/shell.rs`, `crates/cli/src/install.rs`, `crates/cli/src/daemon.rs`, `crates/cli/src/config.rs`
- Depends on: `clap`, `reqwest`, `dirs`, `ccgw-core`
- Used by: the `ccg` binary declared in `crates/cli/Cargo.toml`
- Purpose: operator UI for gateway status, config editing, logs, and desktop preferences.
- Location: `crates/desktop/src/`
- Contains: `crates/desktop/src/App.tsx`, `crates/desktop/src/api.ts`, `crates/desktop/src/status/StatusTab.tsx`, `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/i18n/index.ts`
- Depends on: React, Tauri JS APIs, `i18next`, `lucide-react`
- Used by: `crates/desktop/src/main.tsx` and Vite/Tauri builds
- Purpose: native command bridge, daemon lifecycle control, config/log file access, tray integration, and persisted desktop settings.
- Location: `crates/desktop/src-tauri/src/`
- Contains: `crates/desktop/src-tauri/src/main.rs`, `crates/desktop/src-tauri/src/commands.rs`, `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src-tauri/src/settings.rs`
- Depends on: `tauri`, `reqwest`, `ccgw-core`, filesystem/process APIs
- Used by: `invoke()` calls from `crates/desktop/src/api.ts`
## Data Flow
- Runtime request state is in memory: token maps in `src/auth.ts` / `crates/core/src/auth.rs`, cached OAuth tokens in `src/oauth.ts` / `crates/core/src/oauth.rs`, and desktop daemon child/process metadata in `crates/desktop/src-tauri/src/daemon.rs`.
- Persistent operator state lives in files: `config.yaml` or `~/.ccgw/config.yaml`, canonical profile JSON under `config/`, desktop settings at `~/.ccgw/desktop-settings.json` via `crates/desktop/src-tauri/src/settings.rs`, and daemon logs under `~/.ccgw/logs/desktop-daemon.log` via `crates/desktop/src-tauri/src/daemon.rs`.
## Key Abstractions
- Purpose: unified contract for server, auth, OAuth, identity, env masking, prompt masking, process ranges, and rewrite policy.
- Examples: `src/config.ts`, `crates/core/src/config.rs`, `config.example.yaml`, `config/canonical-profile.schema.json`
- Pattern: parse-validate-load; optional `canonical_profile_path` overrides inline identity/env/prompt/process sections
- Purpose: local client authentication before the gateway touches upstream APIs.
- Examples: `src/auth.ts`, `crates/core/src/auth.rs`
- Pattern: config-driven lookup keyed by token; request handlers accept `x-api-key` first and bearer auth as fallback
- Purpose: keep the upstream Anthropic OAuth token fresh and available to request handlers.
- Examples: `src/oauth.ts`, `crates/core/src/oauth.rs`
- Pattern: startup reuse of valid tokens, background refresh scheduling, lazy refresh on demand when needed
- Purpose: isolate payload mutations by concern instead of mixing them into HTTP handlers.
- Examples: `src/rewriter.ts`, `crates/core/src/rewriter/identity.rs`, `crates/core/src/rewriter/env.rs`, `crates/core/src/rewriter/prompt.rs`, `crates/core/src/rewriter/headers.rs`
- Pattern: thin transport layer + dedicated transformation helpers; Rust splits concerns into submodules while TypeScript keeps one consolidated module
- Purpose: desktop-local supervisor for spawning, stopping, polling, and locating the Rust daemon plus its log/config paths.
- Examples: `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src-tauri/src/commands.rs`
- Pattern: `Arc<Mutex<...>>` state holder shared across Tauri commands
- Purpose: derive actionable UI categories from daemon health, config summary, and settings.
- Examples: `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/status/types.ts`, `crates/desktop/src/status/StatusTab.tsx`
- Pattern: compute category/group/item trees, then render reusable markers and action buttons
## Entry Points
- Location: `src/index.ts`
- Triggers: root `package.json` scripts such as `npm run dev` and `npm start`
- Responsibilities: load config, configure logging, initialize OAuth, start the TypeScript proxy
- Location: `crates/daemon/src/main.rs`
- Triggers: the `ccgw-daemon` binary or desktop spawning from `crates/desktop/src-tauri/src/daemon.rs`
- Responsibilities: load `Config`, initialize `tracing`, and boot the Axum/TLS server
- Location: `crates/cli/src/main.rs`
- Triggers: `ccg`, `ccg install`, `ccg status`, `ccg hijack`, `ccg release`, `ccg native`
- Responsibilities: parse subcommands, inject launch env vars, manage shell aliases, check daemon health
- Location: `crates/desktop/src/main.tsx`
- Triggers: Vite dev server and packaged desktop app frontend load
- Responsibilities: mount React and hand off to `crates/desktop/src/App.tsx`
- Location: `crates/desktop/src-tauri/src/main.rs`
- Triggers: `npm run tauri` or packaged desktop application startup
- Responsibilities: register plugins, manage window/tray behavior, expose command handlers, own shared daemon state
## Error Handling
- Config validation is centralized in `src/config.ts` and `crates/core/src/config.rs`; invalid config blocks gateway startup and is surfaced to desktop users through `crates/desktop/src-tauri/src/commands.rs`.
- Proxy handlers in `src/proxy.ts` and `crates/daemon/src/server.rs` return explicit `401`, `503`, `502`, or `400` JSON payloads instead of silent failures.
- Desktop commands in `crates/desktop/src-tauri/src/commands.rs` use `Result<_, String>` so `crates/desktop/src/App.tsx` can render actionable UI errors.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
