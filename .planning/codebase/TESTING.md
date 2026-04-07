# Testing Patterns

**Analysis Date:** 2026-04-08

## Test Framework

**Runner:**
- Root gateway TypeScript: no formal runner; tests are executable TS scripts under `tests/` using `tsx` plus Node `assert`.
- Desktop React: Vitest 1.1 with jsdom from `crates/desktop/vitest.config.ts`.
- Rust crates: `cargo test` with inline unit tests and integration tests, including async tests via `#[tokio::test]`.

**Assertion Library:**
- Root TS: `assert` from Node in `tests/config.test.ts`, `tests/oauth.test.ts`, and `tests/rewriter.test.ts`.
- Desktop: `expect` from Vitest plus `@testing-library/jest-dom/vitest` from `crates/desktop/src/test/setup.ts`.
- Rust: built-in `assert!`/`assert_eq!`.

**Run Commands:**
```bash
npm test                                  # Root TS suite: runs tests/rewriter.test.ts and tests/oauth.test.ts
tsx tests/config.test.ts                  # Root config suite; present but not included in npm test
npm --prefix crates/desktop test          # Desktop Vitest suite
cargo test                                # Rust unit + integration tests across workspace
cargo test -p ccgw-daemon --test daemon   # Daemon integration tests only
```

## Test File Organization

**Location:**
- Root TS uses a separate `tests/` directory: `tests/config.test.ts`, `tests/oauth.test.ts`, `tests/rewriter.test.ts`.
- Desktop UI keeps tests co-located with the feature: `crates/desktop/src/status/dashboard.test.tsx`.
- Rust uses both inline module tests and crate-level integration tests:
  - inline: `crates/core/src/oauth.rs`, `crates/cli/src/launcher.rs`, `crates/desktop/src-tauri/src/settings.rs`
  - integration: `crates/core/tests/config_integration.rs`, `crates/daemon/tests/daemon.rs`

**Naming:**
- TS follows `*.test.ts` / `*.test.tsx`.
- Rust integration tests use descriptive filenames like `config_integration.rs` and `daemon.rs`.

**Structure:**
```text
tests/                           # Standalone TS scripts
crates/desktop/src/**/**/*.test.tsx
crates/*/src/*.rs               # Inline #[cfg(test)] mod tests
crates/*/tests/*.rs             # Rust integration tests
```

## Test Structure

**Suite Organization:**
```typescript
let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>) { /* ... */ }

async function main() {
  for (const t of tests) await t()
  if (failed > 0) process.exit(1)
}
```
- This manual harness pattern appears in `tests/oauth.test.ts`.

```typescript
describe('Status Dashboard Tests', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders user-facing categories and default detail panel', () => { /* ... */ })
})
```
- This Vitest pattern appears in `crates/desktop/src/status/dashboard.test.tsx`.

**Patterns:**
- Setup/teardown in root TS is explicit and file-local, for example `setup()` / `teardown()` in `tests/config.test.ts`.
- Desktop tests reset mocks with `beforeEach(() => vi.clearAllMocks())` in `crates/desktop/src/status/dashboard.test.tsx`.
- Rust tests prefer local helpers such as `spawn_mock_server(...)` in `crates/core/src/oauth.rs` and `spawn_daemon(...)` in `crates/daemon/tests/daemon.rs`.
- Manual parity tracking exists in `tests/parity-checklist.md` to map TS expectations to Rust coverage.

## Mocking

**Framework:** Vitest mocks in desktop; handwritten doubles and spawned local services elsewhere.

**Patterns:**
```typescript
vi.mock('./notifications', () => ({
  notifyDanger: vi.fn(() => Promise.resolve()),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
```
- This is the dominant desktop mock style in `crates/desktop/src/status/dashboard.test.tsx`.

```typescript
class OAuthMock {
  refreshCallCount = 0
  async refreshOAuthToken(refreshToken: string) { /* ... */ }
}
```
- Root TS uses handwritten behavior doubles instead of a mocking library in `tests/oauth.test.ts`.

```rust
let (token_url, requests, _server) = spawn_mock_server(vec![MockResponse { ... }]).await;
```
- Rust favors real async listeners and captured requests over pure mocks in `crates/core/src/oauth.rs` and `crates/daemon/tests/daemon.rs`.

**What to Mock:**
- Browser/Tauri-only boundaries in desktop tests, especially notifications and translation hooks.
- OAuth/token servers and upstream proxy behavior via local listeners in Rust integration tests.
- Environment mutation should be serialized with `env_lock()` from `crates/cli/src/test_support.rs`.

**What NOT to Mock:**
- Pure rewrite logic in `src/rewriter.ts` and `crates/core/src/rewriter/*.rs`; tests feed real payloads into the actual rewriters.
- Config parsing/validation in `src/config.ts` and `crates/core/tests/config_integration.rs`; tests write real YAML/JSON fixtures to disk.

## Fixtures and Factories

**Test Data:**
```typescript
const config: ConfigSnapshot = {
  path: '/Users/test/.ccgw/config.yaml',
  exists: true,
  summary: { /* ... */ },
}
```
- Inline object fixtures are common in `crates/desktop/src/status/dashboard.test.tsx` and `tests/rewriter.test.ts`.

```rust
let temp_dir = TempDir::new().unwrap();
let path = temp_dir.path().join("config.yaml");
```
- Rust tests prefer `tempfile::TempDir` and temp files in `crates/core/tests/config_integration.rs`, `crates/desktop/src-tauri/src/commands.rs`, and `crates/desktop/src-tauri/src/settings.rs`.

**Location:**
- No shared fixture directory is present.
- Fixtures live inline beside each suite, or are generated on demand in temp directories.

## Coverage

**Requirements:** No enforced coverage target or threshold is configured.

**Coverage signals:**
- Strong coverage exists for config parsing, rewrite semantics, OAuth timing, daemon request forwarding, and the desktop status dashboard.
- `tests/parity-checklist.md` is used as a manual coverage map for TS/Rust parity.
- Root `npm test` does not include `tests/config.test.ts`, so full TS coverage requires running that file separately.

**View Coverage:**
```bash
Not configured
```

## Test Types

**Unit Tests:**
- Root TS tests behave as focused unit/behavior tests for config, OAuth timing, and payload/header rewriting in `tests/*.ts`.
- Rust inline tests verify small units such as token refresh timing in `crates/core/src/oauth.rs` and settings persistence in `crates/desktop/src-tauri/src/settings.rs`.

**Integration Tests:**
- `crates/daemon/tests/daemon.rs` spins up an upstream server and the daemon app, then exercises auth, rewrites, chunked streaming, and health endpoints end to end.
- `crates/core/tests/config_integration.rs` loads actual YAML and JSON files to verify parser/validation behavior against disk fixtures.

**E2E Tests:**
- Browser/UI E2E is not used.
- `webdriverio` is listed in `crates/desktop/package.json`, but no WebdriverIO specs or configured E2E suite are present.

## Common Patterns

**Async Testing:**
```typescript
const { rerender } = renderHook(
  ({ status, health }) => useHealthDashboard(status, health, config, settings, false),
  { initialProps: { status: 'running', health: healthyHealth } },
)
```
- Hook testing with `renderHook` and `rerender` appears in `crates/desktop/src/status/dashboard.test.tsx`.

```rust
#[tokio::test]
async fn health_endpoint_is_public() {
  let upstream = spawn_upstream().await;
  let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
}
```
- Async integration tests with spawned listeners are the standard Rust network-testing pattern in `crates/daemon/tests/daemon.rs`.

**Error Testing:**
```typescript
try {
  loadConfig(configPath)
  assert.fail('Should have thrown error')
} catch (err: any) {
  assert(err.message.includes('40+ keys'))
}
```
- Root TS uses explicit `try/catch` assertions in `tests/config.test.ts`.

```rust
let result = handle_status().await;
assert!(result.is_err());
```
- Rust checks failure paths directly in async command tests such as `crates/cli/src/tests.rs`.

## Current Gaps To Respect When Adding Tests

- Add new root TS tests under `tests/` only if they can run as standalone `tsx` scripts, or update `package.json` so they are actually executed.
- Keep desktop component tests near the feature under `crates/desktop/src/`; current setup expects jsdom and `@testing-library/jest-dom/vitest` from `crates/desktop/src/test/setup.ts`.
- Prefer Rust integration tests for proxy/network behavior; the existing pattern already captures real requests in `crates/daemon/tests/daemon.rs`.
- Reuse `env_lock()` from `crates/cli/src/test_support.rs` before mutating process environment in Rust tests.

---

*Testing analysis: 2026-04-08*
