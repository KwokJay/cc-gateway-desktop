# Coding Conventions

**Analysis Date:** 2026-04-08

## Naming Patterns

**Files:**
- Follow the local package style instead of forcing one repo-wide style.
- Gateway Node/TS files under `src/` use lowercase or kebab-case names such as `src/config.ts`, `src/proxy-agent.ts`, and `src/scripts/generate-token.ts`.
- React component files under `crates/desktop/src/` use PascalCase when they export a component, for example `crates/desktop/src/App.tsx`, `crates/desktop/src/status/StatusTab.tsx`, and `crates/desktop/src/status/StateMarker.tsx`.
- React hooks and helpers use camelCase file names, for example `crates/desktop/src/status/useHealthDashboard.ts`, `crates/desktop/src/api.ts`, and `crates/desktop/src/status/notifications.ts`.
- Rust modules use snake_case file names such as `crates/core/src/oauth.rs`, `crates/daemon/src/server.rs`, and `crates/desktop/src-tauri/src/settings.rs`.

**Functions:**
- Use camelCase in TypeScript for functions and helpers: `loadConfig` in `src/config.ts`, `rewriteBody` in `src/rewriter.ts`, `fileTarget` in `crates/desktop/src/App.tsx`, and `notifyDanger` in `crates/desktop/src/status/notifications.ts`.
- Use snake_case in Rust for functions and methods: `build_state` in `crates/daemon/src/server.rs`, `prepare_launch_env` in `crates/cli/src/launcher.rs`, and `save_to_path` in `crates/desktop/src-tauri/src/settings.rs`.

**Variables:**
- Use camelCase for local TS variables: `configPath` in `src/index.ts`, `oauthState` in `crates/desktop/src/status/useHealthDashboard.ts`, and `selectedCategory` in `crates/desktop/src/status/StatusTab.tsx`.
- Keep external-contract fields in snake_case when they mirror YAML/JSON payloads, for example `canonical_profile_path`, `device_id`, `account_uuid`, and `expires_at` in `src/config.ts`.
- Use `SCREAMING_SNAKE_CASE` for module constants: `TOKEN_URL`, `CLIENT_ID`, and `DEFAULT_SCOPES` in `src/oauth.ts`; `MIN_REFRESH_DELAY` and `RETRY_DELAY` in `crates/core/src/oauth.rs`.

**Types:**
- Use PascalCase for TS types and interfaces: `Config`, `CanonicalProfile` in `src/config.ts`; `ConfigSummary`, `DesktopSettings`, and `PromptEnvSummary` in `crates/desktop/src/api.ts`.
- Use PascalCase for Rust structs/enums and pair them with serde rename rules at boundaries, for example `ConfigSummary` with `#[serde(rename_all = "camelCase")]` in `crates/desktop/src-tauri/src/commands.rs` and `OAuthConfig` with `#[serde(rename_all = "snake_case")]` in `crates/core/src/config.rs`.

## Code Style

**Formatting:**
- No ESLint, Prettier, or Biome config is present at the repo root or in `crates/desktop/`.
- TypeScript style is package-local:
  - `src/` uses no semicolons and `.js` suffixes in relative imports, e.g. `import { loadConfig } from './config.js'` in `src/index.ts`.
  - `crates/desktop/src/` uses semicolons and extensionless relative imports, e.g. `import App from './App';` in `crates/desktop/src/main.tsx`.
- Rust follows standard rustfmt-style layout; no custom `rustfmt.toml` is detected.

**Linting:**
- No explicit linter configuration is detected.
- Type safety is enforced mainly through strict compiler settings:
  - `tsconfig.json` enables `strict` for `src/`.
  - `crates/desktop/tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.

## Import Organization

**Order:**
1. Platform/framework imports first.
2. Type-only imports next when available.
3. Local relative imports last.

**Observed patterns:**
- Gateway TS keeps Node built-ins before local modules, for example `src/proxy.ts`.
- Desktop TS keeps third-party UI/runtime imports first, then side-effect imports, then local modules, for example `crates/desktop/src/App.tsx` and `crates/desktop/src/status/StatusTab.tsx`.
- Rust groups imports as standard library, third-party crates, then `crate::...` or workspace crate imports, for example `crates/core/src/oauth.rs` and `crates/daemon/src/server.rs`.

**Path Aliases:**
- No TS path aliases are configured. Use relative imports.
- Root runtime TS uses explicit emitted-extension imports (`'./config.js'`, `'./logger.js'`).
- Desktop React TS uses extensionless relative imports (`'./StatusTab'`, `'../api'`).

## Error Handling

**Patterns:**
- Throw detailed validation errors near parsing boundaries in `src/config.ts`; the strings are meant to be user-actionable.
- Wrap process entrypoints in one top-level failure handler, for example `src/index.ts` and `crates/daemon/src/main.rs`.
- Use best-effort `try/catch` around rewrite or UI-side effects when failure should degrade instead of crash, for example `src/rewriter.ts`, `src/proxy.ts`, and `crates/desktop/src/status/notifications.ts`.
- In Rust, prefer typed errors for config parsing (`ConfigError` in `crates/core/src/config.rs`) and `anyhow::Result` plus `.context(...)` for command/server orchestration (`crates/cli/src/main.rs`, `crates/daemon/src/server.rs`).
- Preserve transport contracts at TS/Rust boundaries with serde rename attributes instead of ad-hoc field mapping, for example `crates/desktop/src-tauri/src/commands.rs`.

## Logging

**Framework:** console in `src/`; `tracing` in Rust crates; `console.error`/`console.warn` for desktop UI diagnostics.

**Patterns:**
- Use `log(level, message, extra?)` and `audit(...)` from `src/logger.ts` instead of raw `console.log` in gateway runtime code.
- Gateway request flow logs method/path/client in `src/proxy.ts`.
- Rust services log structured lifecycle and error events with `info!`, `warn!`, and `error!` in `crates/daemon/src/server.rs` and `crates/core/src/logger.rs`.
- Desktop UI logs only operational failures that are not surfaced as inline state, for example `console.error('Health check failed', healthErr);` in `crates/desktop/src/App.tsx`.

## Comments

**When to Comment:**
- Comments explain protocol semantics, safety constraints, and ordered rewrite steps rather than obvious code.
- Examples:
  - numbered rewrite order comments in `src/rewriter.ts`
  - request/auth flow comments in `src/proxy.ts`
  - CLI comments in Chinese in `crates/cli/src/launcher.rs`
  - section-divider comments in `tests/rewriter.test.ts`

**JSDoc/TSDoc:**
- Used selectively for behavior-heavy exported helpers such as `initOAuth` in `src/oauth.ts`, `rewriteBody` in `src/rewriter.ts`, and `notifyDanger` in `crates/desktop/src/status/notifications.ts`.
- Most internal helpers rely on naming plus short inline comments instead of full docblocks.

## Function Design

**Size:** keep exported entrypoints readable by pushing protocol details into helpers.
- `rewriteBody` in `src/rewriter.ts` dispatches to `rewriteMessagesBody`, `rewriteEventBatch`, and `rewriteGenericIdentity`.
- `useHealthDashboard` in `crates/desktop/src/status/useHealthDashboard.ts` builds data via small pure helper closures such as `buildChecksCategory` and `resultItem`.
- `run` in `crates/daemon/src/server.rs` delegates setup to `build_state`, `router`, and `log_startup`.

**Parameters:**
- Pass typed config/state objects instead of long primitive lists, for example `rewriteBody(body, path, config)` in `src/rewriter.ts` and `build_config_summary(config)` in `crates/desktop/src-tauri/src/commands.rs`.
- Prefer explicit string unions for UI/runtime state, for example `DaemonStatus` in `crates/desktop/src/App.tsx` and `HealthState` in `crates/desktop/src/status/types.ts`.

**Return Values:**
- TS runtime helpers return concrete values or `null` for degraded states, for example `getAccessToken(): string | null` in `src/oauth.ts`.
- Rust returns `Result<T, E>` nearly everywhere at IO/network boundaries.

## Module Design

**Exports:**
- Prefer named exports in runtime TS (`src/config.ts`, `src/logger.ts`, `src/rewriter.ts`) and desktop helpers (`crates/desktop/src/api.ts`, `crates/desktop/src/status/notifications.ts`).
- Default exports are limited to app bootstrap modules such as `crates/desktop/src/App.tsx` and `crates/desktop/src/i18n/index.ts`.
- Rust uses `lib.rs` re-exports to define the crate surface, especially `crates/core/src/lib.rs`.

**Barrel Files:**
- No TS barrel-file pattern is used.
- `crates/core/src/lib.rs` acts as the Rust barrel/re-export surface for the shared core crate.

**Boundary conventions to keep:**
- Keep snake_case for config/proxy payload fields in `src/` and `crates/core/`.
- Keep camelCase for data sent into the desktop React layer, backed by `#[serde(rename_all = "camelCase")]` in `crates/desktop/src-tauri/src/commands.rs`.
- Keep UI text routed through `useTranslation()` and locale JSON files in `crates/desktop/src/i18n/` instead of hardcoded component strings.

---

*Convention analysis: 2026-04-08*
