# Architecture

**Analysis Date:** 2026-04-08

## Pattern Overview

**Overall:** Hybrid monorepo with one standalone TypeScript gateway and three Rust runtime surfaces built around a shared core crate.

**Key Characteristics:**

- Shared Rust domain logic is centralized in `crates/core/src/` and reused by `crates/daemon/src/`, `crates/cli/src/`, and `crates/desktop/src-tauri/src/`.
- `src/` remains a runnable Node.js gateway and the behavior reference used by parity notes in `docs/rust-ts-parity-checklist.md` and parity tests in `tests/`.
- The desktop product is split into a React/Vite frontend in `crates/desktop/src/` and a Tauri/native backend in `crates/desktop/src-tauri/src/`.

## Layers

**TypeScript reference gateway:**

- Purpose: runnable Node prototype and reference behavior for auth, OAuth, request rewriting, and proxy forwarding.
- Location: `src/`
- Contains: `src/index.ts`, `src/proxy.ts`, `src/rewriter.ts`, `src/config.ts`, `src/oauth.ts`, `src/auth.ts`
- Depends on: Node stdlib, `yaml`, `https-proxy-agent`
- Used by: root `package.json` scripts, root `tests/*.test.ts`, and parity comparisons against Rust code

**Shared Rust core:**

- Purpose: reusable config parsing, token auth, OAuth refresh, logging, and payload/header rewrite primitives.
- Location: `crates/core/src/`
- Contains: `crates/core/src/config.rs`, `crates/core/src/auth.rs`, `crates/core/src/oauth.rs`, `crates/core/src/logger.rs`, `crates/core/src/rewriter/*.rs`
- Depends on: `serde`, `reqwest`, `http`, `chrono`, `regex`, `base64`, `rand`, `sha2`
- Used by: `crates/daemon/src/server.rs`, `crates/desktop/src-tauri/src/commands.rs`, and any future Rust runtime surface

**Rust daemon:**

- Purpose: the production-style HTTP/TLS reverse proxy that accepts client traffic and forwards it upstream.
- Location: `crates/daemon/src/`
- Contains: `crates/daemon/src/main.rs`, `crates/daemon/src/server.rs`
- Depends on: `ccgw-core`, `axum`, `axum-server`, `reqwest`
- Used by: direct daemon runs and desktop process supervision in `crates/desktop/src-tauri/src/daemon.rs`

**CLI launcher/admin surface:**

- Purpose: local `ccg` launcher that injects gateway env vars, installs/uninstalls the binary, manages shell aliases, and checks daemon health.
- Location: `crates/cli/src/`
- Contains: `crates/cli/src/main.rs`, `crates/cli/src/launcher.rs`, `crates/cli/src/shell.rs`, `crates/cli/src/install.rs`, `crates/cli/src/daemon.rs`, `crates/cli/src/config.rs`
- Depends on: `clap`, `reqwest`, `dirs`, `ccgw-core`
- Used by: the `ccg` binary declared in `crates/cli/Cargo.toml`

**Desktop frontend:**

- Purpose: operator UI for gateway status, config editing, logs, and desktop preferences.
- Location: `crates/desktop/src/`
- Contains: `crates/desktop/src/App.tsx`, `crates/desktop/src/api.ts`, `crates/desktop/src/status/StatusTab.tsx`, `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/i18n/index.ts`
- Depends on: React, Tauri JS APIs, `i18next`, `lucide-react`
- Used by: `crates/desktop/src/main.tsx` and Vite/Tauri builds

**Desktop Tauri backend:**

- Purpose: native command bridge, daemon lifecycle control, config/log file access, tray integration, and persisted desktop settings.
- Location: `crates/desktop/src-tauri/src/`
- Contains: `crates/desktop/src-tauri/src/main.rs`, `crates/desktop/src-tauri/src/commands.rs`, `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src-tauri/src/settings.rs`
- Depends on: `tauri`, `reqwest`, `ccgw-core`, filesystem/process APIs
- Used by: `invoke()` calls from `crates/desktop/src/api.ts`

## Data Flow

**Gateway request flow:**

1. Entry points `src/index.ts` or `crates/daemon/src/main.rs` load YAML config through `src/config.ts` or `crates/core/src/config.rs`.
2. Startup initializes token state with `src/auth.ts` / `crates/core/src/auth.rs` and OAuth state with `src/oauth.ts` / `crates/core/src/oauth.rs`.
3. Request handlers in `src/proxy.ts` and `crates/daemon/src/server.rs` authenticate the client token before forwarding traffic.
4. Rewrite logic transforms body and headers through `src/rewriter.ts` or the Rust modules in `crates/core/src/rewriter/`.
5. The gateway injects the upstream OAuth token, forwards to `config.upstream.url`, and streams the response back to the caller (`proxyRes.pipe(res)` in `src/proxy.ts`; `Body::from_stream(upstream_response.bytes_stream())` in `crates/daemon/src/server.rs`).

**Desktop control flow:**

1. React state in `crates/desktop/src/App.tsx` polls daemon status and loads config/log/settings through wrapper functions in `crates/desktop/src/api.ts`.
2. Those wrapper functions call Tauri commands exposed from `crates/desktop/src-tauri/src/commands.rs`.
3. The command layer delegates daemon process management to `crates/desktop/src-tauri/src/daemon.rs`, config parsing to `ccgw_core::Config`, and settings persistence to `crates/desktop/src-tauri/src/settings.rs`.
4. The frontend turns raw snapshots into grouped checks in `crates/desktop/src/status/useHealthDashboard.ts` and renders them in `crates/desktop/src/status/StatusTab.tsx`.

**State Management:**

- Runtime request state is in memory: token maps in `src/auth.ts` / `crates/core/src/auth.rs`, cached OAuth tokens in `src/oauth.ts` / `crates/core/src/oauth.rs`, and desktop daemon child/process metadata in `crates/desktop/src-tauri/src/daemon.rs`.
- Persistent operator state lives in files: `config.yaml` or `~/.ccgw/config.yaml`, canonical profile JSON under `config/`, desktop settings at `~/.ccgw/desktop-settings.json` via `crates/desktop/src-tauri/src/settings.rs`, and daemon logs under `~/.ccgw/logs/desktop-daemon.log` via `crates/desktop/src-tauri/src/daemon.rs`.

## Key Abstractions

**Config / CanonicalProfile:**

- Purpose: unified contract for server, auth, OAuth, identity, env masking, prompt masking, process ranges, and rewrite policy.
- Examples: `src/config.ts`, `crates/core/src/config.rs`, `config.example.yaml`, `config/canonical-profile.schema.json`
- Pattern: parse-validate-load; optional `canonical_profile_path` overrides inline identity/env/prompt/process sections

**AuthManager / token map:**

- Purpose: local client authentication before the gateway touches upstream APIs.
- Examples: `src/auth.ts`, `crates/core/src/auth.rs`
- Pattern: config-driven lookup keyed by token; request handlers accept `x-api-key` first and bearer auth as fallback

**OAuthManager / cached token state:**

- Purpose: keep the upstream Anthropic OAuth token fresh and available to request handlers.
- Examples: `src/oauth.ts`, `crates/core/src/oauth.rs`
- Pattern: startup reuse of valid tokens, background refresh scheduling, lazy refresh on demand when needed

**Rewriter modules:**

- Purpose: isolate payload mutations by concern instead of mixing them into HTTP handlers.
- Examples: `src/rewriter.ts`, `crates/core/src/rewriter/identity.rs`, `crates/core/src/rewriter/env.rs`, `crates/core/src/rewriter/prompt.rs`, `crates/core/src/rewriter/headers.rs`
- Pattern: thin transport layer + dedicated transformation helpers; Rust splits concerns into submodules while TypeScript keeps one consolidated module

**DaemonProcess:**

- Purpose: desktop-local supervisor for spawning, stopping, polling, and locating the Rust daemon plus its log/config paths.
- Examples: `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src-tauri/src/commands.rs`
- Pattern: `Arc<Mutex<...>>` state holder shared across Tauri commands

**Health dashboard model:**

- Purpose: derive actionable UI categories from daemon health, config summary, and settings.
- Examples: `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/status/types.ts`, `crates/desktop/src/status/StatusTab.tsx`
- Pattern: compute category/group/item trees, then render reusable markers and action buttons

## Entry Points

**Node gateway:**

- Location: `src/index.ts`
- Triggers: root `package.json` scripts such as `npm run dev` and `npm start`
- Responsibilities: load config, configure logging, initialize OAuth, start the TypeScript proxy

**Rust daemon binary:**

- Location: `crates/daemon/src/main.rs`
- Triggers: the `ccgw-daemon` binary or desktop spawning from `crates/desktop/src-tauri/src/daemon.rs`
- Responsibilities: load `Config`, initialize `tracing`, and boot the Axum/TLS server

**CLI binary:**

- Location: `crates/cli/src/main.rs`
- Triggers: `ccg`, `ccg install`, `ccg status`, `ccg hijack`, `ccg release`, `ccg native`
- Responsibilities: parse subcommands, inject launch env vars, manage shell aliases, check daemon health

**Desktop frontend:**

- Location: `crates/desktop/src/main.tsx`
- Triggers: Vite dev server and packaged desktop app frontend load
- Responsibilities: mount React and hand off to `crates/desktop/src/App.tsx`

**Tauri shell:**

- Location: `crates/desktop/src-tauri/src/main.rs`
- Triggers: `npm run tauri` or packaged desktop application startup
- Responsibilities: register plugins, manage window/tray behavior, expose command handlers, own shared daemon state

## Error Handling

**Strategy:** Fail fast on invalid startup config, return structured JSON errors at the proxy boundary, and surface desktop failures as validation messages or stringified command errors.

**Patterns:**

- Config validation is centralized in `src/config.ts` and `crates/core/src/config.rs`; invalid config blocks gateway startup and is surfaced to desktop users through `crates/desktop/src-tauri/src/commands.rs`.
- Proxy handlers in `src/proxy.ts` and `crates/daemon/src/server.rs` return explicit `401`, `503`, `502`, or `400` JSON payloads instead of silent failures.
- Desktop commands in `crates/desktop/src-tauri/src/commands.rs` use `Result<_, String>` so `crates/desktop/src/App.tsx` can render actionable UI errors.

## Cross-Cutting Concerns

**Logging:** `src/logger.ts` provides the TypeScript console/audit logger; `crates/core/src/logger.rs` configures Rust `tracing`; `crates/desktop/src-tauri/src/daemon.rs` appends daemon stdout/stderr to `~/.ccgw/logs/desktop-daemon.log`.

**Validation:** `src/config.ts` and `crates/core/src/config.rs` enforce config shape; `crates/desktop/src-tauri/src/commands.rs` writes config through a temp file and validates it before replacing the saved file.

**Authentication:** client-to-gateway auth is enforced in `src/auth.ts` and `crates/core/src/auth.rs`; gateway-to-Anthropic auth is injected from refreshed OAuth state in `src/oauth.ts` and `crates/core/src/oauth.rs`.

---

*Architecture analysis: 2026-04-08*