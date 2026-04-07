# Technology Stack

**Analysis Date:** 2026-04-08

## Languages

**Primary:**
- Rust (edition 2021) - production gateway, shared rewriting core, CLI, and Tauri backend in `Cargo.toml`, `crates/core/`, `crates/daemon/`, `crates/cli/`, and `crates/desktop/src-tauri/`.
- TypeScript (5.x) - legacy/prototype gateway and desktop frontend in `src/`, `tests/`, `tsconfig.json`, and `crates/desktop/src/`.

**Secondary:**
- Bash - setup, deployment, and client-launcher generation in `scripts/add-client.sh`, `scripts/admin-setup.sh`, `scripts/quick-setup.sh`, and `scripts/extract-token.sh`.
- YAML and JSON - runtime configuration and canonical profile contracts in `config.example.yaml`, `config/canonical-profile.example.json`, `config/canonical-profile.schema.json`, and `crates/desktop/src-tauri/tauri.conf.json`.

## Runtime

**Environment:**
- Node.js 22+ - root gateway prototype and setup scripts are designed around Node in `README.md`, `Dockerfile`, and `package.json`.
- Tokio 1.36 - async runtime for Rust gateway and OAuth refresh loops in `Cargo.toml`, `crates/daemon/src/main.rs`, and `crates/core/src/oauth.rs`.
- Tauri 2.0 - desktop runtime, tray integration, autostart, and command bridge in `crates/desktop/src-tauri/Cargo.toml` and `crates/desktop/src-tauri/src/main.rs`.

**Package Manager:**
- npm - root JavaScript/TypeScript toolchain in `package.json`.
- Lockfile: present at `package-lock.json`.
- npm - desktop frontend toolchain in `crates/desktop/package.json`.
- Lockfile: present at `crates/desktop/package-lock.json`.
- Cargo - Rust workspace management in `Cargo.toml`.
- Lockfile: present at `Cargo.lock`.

## Frameworks

**Core:**
- Axum 0.7 + Hyper + Tower - Rust HTTP proxy implementation in `Cargo.toml` and `crates/daemon/src/server.rs`.
- Tauri 2.0 - desktop shell and native command surface in `crates/desktop/src-tauri/Cargo.toml` and `crates/desktop/src-tauri/src/main.rs`.
- React 18 + Vite 5 - desktop UI in `crates/desktop/package.json`, `crates/desktop/src/main.tsx`, and `crates/desktop/vite.config.ts`.
- Node built-in `http`/`https` - TypeScript gateway server in `src/proxy.ts`.
- Dual implementation pattern - the repo carries both a Node gateway in `src/index.ts` and a Rust gateway in `crates/daemon/src/main.rs`, with shared canonical-profile semantics mirrored in `src/config.ts` and `crates/core/src/config.rs`.

**Testing:**
- Root TypeScript tests run through `tsx` commands defined in `package.json` and located in `tests/config.test.ts`, `tests/oauth.test.ts`, and `tests/rewriter.test.ts`.
- Vitest 1 + Testing Library - desktop component tests in `crates/desktop/vitest.config.ts`, `crates/desktop/src/test/setup.ts`, and `crates/desktop/src/status/dashboard.test.tsx`.
- Cargo test - Rust unit and integration coverage supported by manifests in `crates/core/Cargo.toml`, `crates/daemon/Cargo.toml`, and `crates/cli/Cargo.toml`.

**Build/Dev:**
- TypeScript compiler 5.7 - root build in `package.json` and `tsconfig.json`.
- TypeScript compiler 5.3 - desktop frontend build in `crates/desktop/package.json` and `crates/desktop/tsconfig.json`.
- `tsx` - root watch/dev workflow in `package.json`.
- Tailwind CSS 3.4 + PostCSS + Autoprefixer - desktop styling in `crates/desktop/tailwind.config.js` and `crates/desktop/postcss.config.js`.
- `tauri-build` - native bundle build hook in `crates/desktop/src-tauri/build.rs`.
- Docker multi-stage Node 22 image - containerized prototype deployment in `Dockerfile`.

## Key Dependencies

**Critical:**
- `reqwest` 0.11 - upstream proxying and OAuth refresh in `Cargo.toml`, `crates/daemon/src/server.rs`, and `crates/core/src/oauth.rs`.
- `axum-server` 0.7 with `tls-rustls` - optional TLS listener in `crates/daemon/Cargo.toml` and `crates/daemon/src/server.rs`.
- `serde`, `serde_yaml`, and `serde_json` - Rust config/canonical-profile loading in `crates/core/src/config.rs`.
- `yaml` 2.7 - TypeScript config parsing in `src/config.ts`.
- `https-proxy-agent` 9 - outbound proxy support for the TypeScript gateway in `src/proxy-agent.ts`.
- `@tauri-apps/api`, `@tauri-apps/plugin-shell`, and `@tauri-apps/plugin-notification` - desktop/native bridge in `crates/desktop/package.json`, `crates/desktop/src/api.ts`, `crates/desktop/src/App.tsx`, and `crates/desktop/src/status/notifications.ts`.
- `i18next` and `react-i18next` - desktop localization in `crates/desktop/src/i18n/index.ts`.

**Infrastructure:**
- `tracing`, `tracing-subscriber`, and `tracing-appender` - Rust logging in `Cargo.toml` and `crates/core/src/logger.rs`.
- `clap` 4.5 - CLI command parsing in `Cargo.toml` and `crates/cli/src/main.rs`.
- `regex`, `sha2`, and `base64` - prompt/env rewriting internals in `crates/core/src/rewriter/prompt.rs` and `crates/core/src/rewriter/env.rs`.
- `lucide-react` - desktop icon set in `crates/desktop/src/App.tsx` and `crates/desktop/src/status/StateMarker.tsx`.
- `webdriverio` is listed in `crates/desktop/package.json`, but no first-party usage was detected under `crates/desktop/src/`.

## Configuration

**Environment:**
- Gateway server config is YAML loaded by `src/config.ts` and `crates/core/src/config.rs`; start from `config.example.yaml`.
- Optional canonical profile JSON is loaded via `canonical_profile_path` from `config/canonical-profile.example.json` and validated against `config/canonical-profile.schema.json`.
- Desktop defaults expect the daemon config at `~/.ccgw/config.yaml`, resolved in `crates/desktop/src-tauri/src/daemon.rs`.
- CLI client config lives at `~/.config/cc-gateway/config.json`, with env fallback in `crates/cli/src/config.rs`.
- Desktop settings persist to `~/.ccgw/desktop-settings.json` in `crates/desktop/src-tauri/src/settings.rs`.
- Desktop logs persist to `~/.ccgw/logs/desktop-daemon.log` through `crates/desktop/src-tauri/src/daemon.rs`.

**Build:**
- Root TS build config: `tsconfig.json`.
- Desktop TS build config: `crates/desktop/tsconfig.json` and `crates/desktop/tsconfig.node.json`.
- Desktop dev/build pipeline: `crates/desktop/vite.config.ts`.
- Desktop test config: `crates/desktop/vitest.config.ts`.
- Native desktop packaging: `crates/desktop/src-tauri/tauri.conf.json`.
- Container build/runtime: `Dockerfile` and `docker-compose.yml`.

## Platform Requirements

**Development:**
- Node.js 22+ is the expected JavaScript runtime for the root gateway and scripts in `README.md` and `Dockerfile`.
- A Rust toolchain capable of building the workspace members in `Cargo.toml` is required for the daemon, CLI, and desktop app.
- The `claude` binary must exist in `PATH` for launcher-based flows in `crates/cli/src/launcher.rs` and `scripts/add-client.sh`.
- macOS-oriented setup tooling is built in: scripts call `security` and reference Claude local credentials in `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, and `scripts/extract-token.sh`.

**Production:**
- The Rust daemon binds `0.0.0.0:<port>` with optional Rustls TLS in `crates/daemon/src/server.rs`.
- Container deployment is supported through `Dockerfile` and `docker-compose.yml`.
- Desktop distribution targets `dmg` and `nsis` bundles via `crates/desktop/src-tauri/tauri.conf.json`.
- The Tauri desktop app expects a `ccgw-daemon` binary either at `target/debug/ccgw-daemon` or on `PATH`, as checked in `crates/desktop/src-tauri/src/daemon.rs`.

---

*Stack analysis: 2026-04-08*
