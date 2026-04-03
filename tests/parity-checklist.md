# TS to Rust parity checklist

This checklist maps the TypeScript source-of-truth tests in `tests/*.ts` to the current Rust coverage surface.

## Config loading parity

- [x] Legacy YAML loads without canonical profile — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`
- [x] Canonical profile overrides inline config — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`
- [x] Canonical profile enforces `40+` env keys — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`
- [x] Canonical profile missing path fails — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`
- [x] Canonical profile wrong version fails — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`
- [x] Canonical profile path resolves relative to config file — `tests/config.test.ts` -> `crates/core/tests/config_integration.rs`

## OAuth timing parity

- [x] Valid token is reused without refresh — `tests/oauth.test.ts` -> `crates/core/src/oauth.rs`
- [x] Exact-expiry semantics replace old five-minute buffer behavior — `tests/oauth.test.ts` -> `crates/core/src/oauth.rs`
- [x] Expired access token is treated as unavailable — `tests/oauth.test.ts` -> `crates/core/src/oauth.rs`
- [x] Refresh scheduling happens at actual expiry — `tests/oauth.test.ts` -> `crates/core/src/oauth.rs`

## Request rewrite and proxy parity

- [x] Message metadata identity is rewritten — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`, `crates/core/src/rewriter/identity.rs`
- [x] System prompt working directory and platform are rewritten — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`, `crates/core/src/rewriter/prompt.rs`
- [x] Billing header is stripped from system payloads — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`, `crates/core/src/rewriter/prompt.rs`
- [x] Event batch env/process identity rewrites preserve canonical shape — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`, `crates/core/src/rewriter/env.rs`
- [x] Sensitive inbound headers are stripped and user-agent is normalized — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`, `crates/core/src/rewriter/headers.rs`
- [x] Non-JSON bodies pass through unchanged — `tests/rewriter.test.ts` -> `crates/daemon/tests/daemon.rs`

## Watch list

- [ ] Add explicit Rust integration coverage for `/settings` and `/policy_limits` payload sanitization such as `baseUrl` stripping.
- [ ] Add explicit Rust coverage for recursive `additional_metadata` identity sanitization depth.
