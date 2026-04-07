# External Integrations

**Analysis Date:** 2026-04-08

## APIs & External Services

**Inference upstream:**
- Anthropic API - primary proxied request destination configured in `config.example.yaml` and exercised by both implementations in `src/proxy.ts` and `crates/daemon/src/server.rs`.
  - SDK/Client: Node built-in `https` in `src/proxy.ts`; Rust `reqwest` in `crates/daemon/src/server.rs`
  - Auth: real OAuth access token is injected into the upstream `x-api-key` header in `src/proxy.ts` and `crates/daemon/src/server.rs`

**OAuth token service:**
- Claude platform OAuth endpoint `https://platform.claude.com/v1/oauth/token` in `src/oauth.ts` and `crates/core/src/oauth.rs`.
  - SDK/Client: Node built-in `https` in `src/oauth.ts`; Rust `reqwest` in `crates/core/src/oauth.rs`
  - Auth: `oauth.refresh_token` from `config.example.yaml` or `~/.ccgw/config.yaml`

**Forward proxy / network egress:**
- User-supplied outbound proxy (Clash/V2Ray/standard HTTP proxy) discovered from environment variables in `src/proxy-agent.ts` and `crates/core/src/proxy_agent.rs`.
  - SDK/Client: `https-proxy-agent` in `src/proxy-agent.ts`; `reqwest::Proxy` in `crates/daemon/src/server.rs` and `crates/core/src/oauth.rs`
  - Auth: proxy credentials are not managed separately in code; they must be embedded in the proxy URL if required

**Desktop-to-daemon local integration:**
- Local desktop control plane over `http://localhost:<port>` for status and health in `crates/desktop/src-tauri/src/daemon.rs`, `crates/desktop/src/api.ts`, and `crates/desktop/src/status/useHealthDashboard.ts`.
  - SDK/Client: Rust `reqwest` for daemon health checks in `crates/desktop/src-tauri/src/daemon.rs`; Tauri `invoke` bridge in `crates/desktop/src/api.ts`
  - Auth: none for local desktop process control; gateway client auth applies only to proxied external traffic

**Local shell / Claude CLI integration:**
- Native `claude` CLI launch with rewritten environment in `crates/cli/src/launcher.rs` and generated shell launchers from `scripts/add-client.sh`.
  - SDK/Client: Rust `std::process::Command` in `crates/cli/src/launcher.rs`; shell wrappers in `scripts/add-client.sh`
  - Auth: launcher exports client token through `ANTHROPIC_API_KEY` and routes traffic through `ANTHROPIC_BASE_URL`

## Data Storage

**Databases:**
- Not detected. No SQL driver, ORM, or external database configuration appears in `src/`, `crates/`, or `config.example.yaml`.

**File Storage:**
- Local filesystem only.
  - Gateway config: `config.yaml` and `config.example.yaml`
  - Desktop daemon config: `~/.ccgw/config.yaml` from `crates/desktop/src-tauri/src/daemon.rs`
  - Desktop settings: `~/.ccgw/desktop-settings.json` from `crates/desktop/src-tauri/src/settings.rs`
  - Desktop logs: `~/.ccgw/logs/desktop-daemon.log` from `crates/desktop/src-tauri/src/daemon.rs`
  - CLI config: `~/.config/cc-gateway/config.json` from `crates/cli/src/config.rs`
  - Canonical profile contract: `config/canonical-profile.example.json`

**Caching:**
- None.
- OAuth tokens are cached in process memory only in `src/oauth.ts` and `crates/core/src/oauth.rs`.

## Authentication & Identity

**Auth Provider:**
- Claude Code / Claude platform OAuth refresh.
  - Implementation: the gateway stores `oauth.access_token`, `oauth.refresh_token`, and `oauth.expires_at` in config and refreshes centrally via `src/oauth.ts` or `crates/core/src/oauth.rs`

**Gateway client authentication:**
- Custom shared-token auth.
  - Implementation: `auth.tokens` entries from `config.example.yaml` are validated in `src/auth.ts` and `crates/core/src/auth.rs`

**Identity normalization:**
- Canonical identity and environment profile loaded from YAML plus optional JSON profile.
  - Implementation: `src/config.ts`, `src/rewriter.ts`, `crates/core/src/config.rs`, and `crates/core/src/rewriter/`

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Bugsnag, Honeycomb, or OpenTelemetry exporter imports were found under `src/` or `crates/`.

**Logs:**
- Node prototype logs to stdout via `src/logger.ts`.
- Rust daemon logs through `tracing` in `crates/core/src/logger.rs` and `crates/daemon/src/main.rs`.
- Desktop captures daemon stdout/stderr into `~/.ccgw/logs/desktop-daemon.log` from `crates/desktop/src-tauri/src/daemon.rs`.
- Health and verification endpoints are built into both implementations in `src/proxy.ts` and `crates/daemon/src/server.rs`.
- Desktop user alerts use OS notifications via `@tauri-apps/plugin-notification` in `crates/desktop/src/status/notifications.ts`.

## CI/CD & Deployment

**Hosting:**
- Containerized Node gateway deployment via `Dockerfile` and `docker-compose.yml`.
- Standalone Rust daemon binary `ccgw-daemon` launched by the Tauri desktop app from `target/debug/ccgw-daemon` or `PATH`, per `crates/desktop/src-tauri/src/daemon.rs`.
- Native desktop bundle targets `dmg` and `nsis` in `crates/desktop/src-tauri/tauri.conf.json`.

**CI Pipeline:**
- Not detected.
- `.github/workflows/` is absent; only repository metadata files were found under `.github/`.

## Environment Configuration

**Required env vars:**
- Optional outbound proxy vars: `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, `http_proxy`, `ALL_PROXY`, and `all_proxy` in `src/proxy-agent.ts` and `crates/core/src/proxy_agent.rs`.
- CLI fallback vars: `CCG_GATEWAY_URL`, `CCG_CLIENT_TOKEN`, and `CCG_CONFIG_PATH` in `crates/cli/src/config.rs`.
- Launcher/runtime vars set before invoking Claude: `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `CLAUDE_CODE_ATTRIBUTION_HEADER` in `crates/cli/src/launcher.rs` and `scripts/add-client.sh`.
- Self-signed HTTPS launcher override: `NODE_TLS_REJECT_UNAUTHORIZED=0` in `scripts/add-client.sh`.

**Secrets location:**
- Server-side OAuth/client tokens live in `config.yaml` or `~/.ccgw/config.yaml`; field layout is documented in `config.example.yaml`.
- Setup scripts extract credentials from macOS Keychain or the user Claude credential file `~/.claude/.credentials.json` in `scripts/quick-setup.sh`, `scripts/admin-setup.sh`, and `scripts/extract-token.sh`.
- Client-side launcher config can be persisted in `~/.config/cc-gateway/config.json` via `crates/cli/src/config.rs`.

## Webhooks & Callbacks

**Incoming:**
- None detected.
- The HTTP surface is a proxy plus utility endpoints only: `/_health`, `/_verify`, `/`, and `/*path` in `src/proxy.ts` and `crates/daemon/src/server.rs`.

**Outgoing:**
- Upstream proxy requests are forwarded to Anthropic paths derived from the incoming request in `src/proxy.ts` and `crates/daemon/src/server.rs`.
- OAuth refresh POSTs go to `https://platform.claude.com/v1/oauth/token` in `src/oauth.ts` and `crates/core/src/oauth.rs`.
- Desktop health polling targets `http://localhost:<port>/_health` in `crates/desktop/src-tauri/src/daemon.rs`.

---

*Integration audit: 2026-04-08*
