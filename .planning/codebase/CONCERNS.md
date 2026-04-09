# Codebase Concerns

**Analysis Date:** 2026-04-08

## Tech Debt

**Dual gateway implementations (TypeScript + Rust):**

- Issue: The repo keeps two production-grade gateway stacks in sync: the legacy Node/TypeScript path in `src/index.ts`, `src/proxy.ts`, `src/oauth.ts`, `src/config.ts`, and `src/rewriter.ts`, plus the Rust daemon/core path in `crates/daemon/src/server.rs`, `crates/core/src/oauth.rs`, `crates/core/src/config.rs`, and `crates/core/src/rewriter/`*.
- Files: `src/index.ts`, `src/proxy.ts`, `src/oauth.ts`, `src/config.ts`, `src/rewriter.ts`, `crates/daemon/src/server.rs`, `crates/core/src/lib.rs`, `crates/core/src/oauth.rs`, `crates/core/src/config.rs`
- Impact: Behavior drift is easy to introduce because auth, OAuth refresh, prompt rewriting, and request forwarding have to be patched twice. Test coverage is also split across runtimes.
- Fix approach: Choose one runtime as the long-term source of truth, freeze the other behind compatibility tests, and delete duplicated business logic once packaging and CLI needs are covered.

**Large monolithic modules raise change risk:**

- Issue: Core behavior is concentrated in very large files instead of smaller domain modules.
- Files: `crates/daemon/src/server.rs` (~~1462 lines), `crates/desktop/src/App.tsx` (~~694 lines), `crates/desktop/src/status/useHealthDashboard.ts` (~~571 lines), `crates/desktop/src-tauri/src/commands.rs` (~~581 lines), `crates/core/src/oauth.rs` (~542 lines)
- Impact: Small edits require broad context, review becomes slower, and unrelated concerns change together.
- Fix approach: Split transport, auth, rewrite-policy, desktop process control, and UI state derivation into focused modules with narrower tests.

**Regex-driven prompt rewriting is tightly coupled to current upstream text formats:**

- Issue: Prompt sanitization relies on hard-coded text patterns for `Platform`, `Shell`, `OS Version`, working directory, and billing header rewriting.
- Files: `src/rewriter.ts:164-221`, `crates/core/src/rewriter/prompt.rs:15-129`
- Impact: Upstream prompt-shape changes can silently bypass sanitization or rewrite the wrong text.
- Fix approach: Centralize pattern ownership, add fixture coverage for newer prompt variants, and prefer structural parsing when upstream payloads expose machine-readable fields.

## Known Bugs

**Desktop health checks break when the daemon is configured with TLS:**

- Symptoms: The desktop app starts the daemon, but health polling still targets `http://localhost:<port>/_health`, so TLS-enabled daemon configs will look unhealthy or fail startup checks.
- Files: `crates/daemon/src/server.rs:55-67`, `crates/desktop/src-tauri/src/daemon.rs:273-306`, `crates/desktop/src-tauri/src/commands.rs:363-399`
- Trigger: Configure `server.tls` in the daemon config and start from the desktop UI.
- Workaround: Use a non-TLS local daemon when running through the desktop UI.

**Desktop status can stay “running” after the daemon exits:**

- Symptoms: The UI keeps reporting `running` while health is `null` because the status endpoint returns cached state and does not check whether the child process already died.
- Files: `crates/desktop/src-tauri/src/daemon.rs:194-199`, `crates/desktop/src-tauri/src/daemon.rs:234-270`, `crates/desktop/src-tauri/src/commands.rs:409-421`, `crates/desktop/src/App.tsx:397-418`
- Trigger: Start the daemon successfully, let it exit later, then wait for the next UI polling cycle.
- Workaround: Restart the desktop app or manually stop/start the daemon from the UI.

## Security Considerations

`**/_health` is intentionally public and leaks deployment metadata:**

- Risk: Anyone who can reach the daemon can read upstream URL, client names, canonical device prefix, and OAuth degradation details without a token.
- Files: `src/proxy.ts:57-70`, `crates/daemon/src/server.rs:111-117`, `crates/daemon/src/server.rs:185-228`, `crates/daemon/tests/daemon.rs`
- Current mitigation: Proxy traffic still requires auth; only the health route is unauthenticated.
- Recommendations: Gate `/_health` behind localhost-only binding, an admin token, or a redacted “public health” mode that omits `clients`, `upstream`, and identity details.

**Desktop renderer receives raw secrets and proxy values:**

- Risk: The Tauri command layer returns full config file contents and raw proxy environment values to the React renderer, which means refresh tokens, client tokens, and authenticated proxy URLs are exposed to any renderer compromise.
- Files: `crates/desktop/src-tauri/src/commands.rs:127-132`, `crates/desktop/src-tauri/src/commands.rs:242-248`, `crates/desktop/src-tauri/src/commands.rs:259-289`, `crates/desktop/src/App.tsx:184-189`, `crates/desktop/src/App.tsx:426-438`
- Current mitigation: None beyond local-app trust.
- Recommendations: Redact secrets in snapshots, move secret editing to targeted Tauri commands, and never send raw proxy credentials or token strings to the webview.

**Daemon is reachable on all interfaces and can run without TLS:**

- Risk: Both runtimes bind publicly (`0.0.0.0`) and the TypeScript server explicitly allows non-TLS mode.
- Files: `src/proxy.ts:23-40`, `crates/daemon/src/server.rs:49-79`
- Current mitigation: Main proxy routes require a client token.
- Recommendations: Add explicit bind-address config, default to loopback for desktop/local installs, and make plaintext mode opt-in with stronger warnings for non-local use.

## Performance Bottlenecks

**Incoming request bodies are fully buffered with no practical size limit:**

- Problem: The TypeScript proxy collects the entire request into memory, and the Rust daemon calls `to_bytes(body, usize::MAX)`.
- Files: `src/proxy.ts:106-111`, `crates/daemon/src/server.rs:299-305`
- Cause: Rewriters operate on a full in-memory JSON payload before forwarding upstream.
- Improvement path: Enforce request-size caps, reject oversized telemetry bodies early, and stream/pass through non-rewritable content without full buffering.

**Desktop log tailing reads the entire log file on every refresh:**

- Problem: The desktop commands layer reads the whole log file into memory and then slices the last N lines.
- Files: `crates/desktop/src-tauri/src/commands.rs:320-331`, `crates/desktop/src/App.tsx:482-492`
- Cause: `tail_lines` uses `fs::read_to_string` instead of a bounded reverse tail.
- Improvement path: Implement a real tail reader or maintain rolling log windows server-side.

**UI polling is constant and unthrottled:**

- Problem: The desktop app polls daemon status every 3 seconds and logs every 2 seconds while the logs tab is open.
- Files: `crates/desktop/src/App.tsx:420-424`, `crates/desktop/src/App.tsx:482-492`
- Cause: Polling is timer-based rather than event-driven.
- Improvement path: Switch to event-based updates from Tauri, back off when hidden, and stop polling logs unless the view is visible and the daemon is running.

## Fragile Areas

**Config save path has a delete-then-rename gap:**

- Files: `crates/desktop/src-tauri/src/commands.rs:291-318`
- Why fragile: `write_validated_config` deletes the existing config before renaming the temp file, so a failed rename can leave the app with no config file at all.
- Safe modification: Keep the replace operation atomic in-place, or write a backup before replacing.
- Test coverage: Only the happy path is covered in `crates/desktop/src-tauri/src/commands.rs` tests; failure injection for rename/remove is missing.

**Desktop process supervision depends on a rarely-called poller:**

- Files: `crates/desktop/src-tauri/src/daemon.rs:240-270`, `crates/desktop/src-tauri/src/commands.rs:363-399`, `crates/desktop/src/App.tsx:397-418`
- Why fragile: Exit detection happens during startup retries, but not during steady-state UI polling.
- Safe modification: Reconcile `get_daemon_status` with `poll_exit`, or move child monitoring into a dedicated background task.
- Test coverage: Startup polling is covered; post-start crash detection is not.

**Prompt rewrite coverage depends on exact field names and message shapes:**

- Files: `src/rewriter.ts:71-79`, `src/rewriter.ts:164-221`, `crates/core/src/rewriter/prompt.rs:21-55`, `crates/core/src/rewriter/prompt.rs:87-129`
- Why fragile: New payload variants or renamed fields will pass through silently because the rewriter does not emit hard failures for unknown schemas.
- Safe modification: Add captured upstream fixtures and schema-drift alarms around the most sensitive paths (`/v1/messages`, `/api/event_logging/batch`).
- Test coverage: Current tests cover the known fixtures but not upstream schema evolution.

## Scaling Limits

**Gateway scaling is bounded by per-request in-memory rewrites:**

- Current capacity: Single-process forwarding with one full request body buffered at a time per active request.
- Limit: Memory use scales with concurrent request size; large telemetry batches can pressure heap usage quickly.
- Scaling path: Add backpressure, body-size limits, and streaming bypass for content that does not need rewriting.

**Desktop observability scales poorly with log growth:**

- Current capacity: `get_daemon_logs` can return only the last N lines, but it still reads the full file first.
- Limit: Large persistent logs will slow down the desktop UI and Tauri backend together.
- Scaling path: Use rolling log files and bounded file reads keyed off the tail region instead of full-file reads.

## Dependencies at Risk

`**webdriverio` is installed without an in-repo E2E suite:**

- Risk: `crates/desktop/package.json` includes `webdriverio`, but the repository does not contain a corresponding WebdriverIO spec tree or runner configuration under `crates/desktop`.
- Impact: Heavier installs, more dependency churn, and extra security/update surface without active coverage value.
- Migration plan: Remove `webdriverio` until an actual desktop E2E suite exists, or commit the missing harness/specs so the dependency pays for itself.

## Missing Critical Features

**No secret-redaction boundary between local config and desktop UI:**

- Problem: The desktop product has a config editor and diagnostics surface, but no explicit redaction layer for tokens, OAuth credentials, or proxy secrets.
- Blocks: Safely using the desktop UI in higher-trust environments or sharing screenshots/logs without manual scrubbing.

**No authenticated/admin-only management surface separation:**

- Problem: Health and management-oriented data are mixed into the main daemon surface instead of being isolated behind loopback or admin auth.
- Blocks: Safer remote deployment, especially when the gateway listens on non-local interfaces.

**No long-running daemon watchdog in the desktop app:**

- Problem: The desktop app can start and stop the daemon, but it does not continuously reconcile process exit state after startup.
- Blocks: Reliable “always-on” desktop supervision and trustworthy status reporting.

## Test Coverage Gaps

**Default root test command skips part of the TypeScript suite and all desktop tests:**

- What's not tested: `package.json` only runs `tests/rewriter.test.ts` and `tests/oauth.test.ts`; it does not run `tests/config.test.ts` or `crates/desktop/src/status/dashboard.test.tsx`.
- Files: `package.json:8-15`, `tests/config.test.ts`, `crates/desktop/package.json:6-12`, `crates/desktop/src/status/dashboard.test.tsx`
- Risk: CI or local “green” checks can miss config regressions and desktop UI regressions unless contributors know to run extra commands manually.
- Priority: High

**TypeScript OAuth tests validate a reimplemented mock, not the production module:**

- What's not tested: `tests/oauth.test.ts` duplicates OAuth behavior in `OAuthMock` instead of importing `src/oauth.ts`.
- Files: `tests/oauth.test.ts:26-131`, `src/oauth.ts`
- Risk: The test suite can stay green while the production implementation changes in incompatible ways.
- Priority: High

**No coverage for desktop TLS lifecycle or post-start crash recovery:**

- What's not tested: Desktop startup against a TLS-enabled daemon config, steady-state child exit detection, and renderer handling of “status says running, health says unreachable”.
- Files: `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src-tauri/src/commands.rs`, `crates/desktop/src/App.tsx`
- Risk: The desktop app’s most operationally sensitive flows fail only in real usage.
- Priority: High

---

*Concerns audit: 2026-04-08*