<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo-light.svg">
    <img alt="CC Gateway" src=".github/logo-light.svg" width="440">
  </picture>

  <p>Take back control of your AI API telemetry</p>
</div>

<div align="center">

[![License: MIT][license-shield]][license-url]
[![Version][version-shield]][version-url]
[![Tests][tests-shield]][tests-url]
[![Follow @whiletrue0x][twitter-shield]][twitter-url]

</div>

<div align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#add-clients">Add Clients</a> &middot;
  <a href="#what-gets-rewritten">What Gets Rewritten</a> &middot;
  <a href="#deployment">Deployment</a> &middot;
  <a href="#changelog">Changelog</a>
</div>

---

> **Acknowledgement** — This project originated from and pays tribute to [motiful/cc-gateway](https://github.com/motiful/cc-gateway). CC Gateway Desktop builds on that foundation while evolving the codebase toward the Rust daemon, CLI, and desktop experience in this repository.

> **Alpha** — This project is under active development. Test with a non-primary account first.

> **Disclaimer** — See [full disclaimer](#disclaimer) below.

## Why

Claude Code collects **640+ telemetry event types** across 3 parallel channels, fingerprints your machine with **40+ environment dimensions**, and phones home every 5 seconds. Your device ID, email, OS version, installed runtimes, shell type, CPU architecture, and physical RAM are all reported to the vendor — continuously.

If you run Claude Code on multiple machines, each device gets a unique permanent identifier. There is no built-in way to manage how your identity is presented to the API.

CC Gateway is a reverse proxy that sits between Claude Code and the Anthropic API. It normalizes device identity, environment fingerprints, and process metrics to a single canonical profile — giving you control over what telemetry leaves your network.

## Features

- **Full identity rewrite** — device ID, email, session metadata, and the `user_id` JSON blob in every API request are normalized to one canonical identity
- **40+ environment dimensions replaced** — platform, architecture, Node.js version, terminal, package managers, runtimes, CI flags, deployment environment — the entire `env` object is swapped, not patched
- **System prompt sanitization** — the `<env>` block injected into every prompt (Platform, Shell, OS Version, working directory) is rewritten to match the canonical profile
- **Billing header stripped** — the `x-anthropic-billing-header` (which contains a per-session fingerprint hash) is removed entirely, consistent with the official `CLAUDE_CODE_ATTRIBUTION_HEADER=false` toggle. This also enables [cross-session prompt cache sharing](https://github.com/anthropics/claude-code/issues/40652), reducing system prompt costs by ~85%
- **Process metrics normalization** — physical RAM (`constrainedMemory`), heap size, and RSS are masked to canonical values so hardware differences don't leak
- **Zero-login client setup** — clients receive a single launcher script. No browser OAuth, no `~/.zshrc` changes, no config files
- **Centralized OAuth** — the gateway manages token refresh internally; client machines never contact `platform.claude.com`
- **Instant startup** — gateway uses your existing access token on launch. No network call until the token actually expires
- **Proxy-aware** — supports `HTTPS_PROXY` / `HTTP_PROXY` env vars for outbound connections (Clash, V2Ray, etc.)
- **Telemetry leak prevention** — strips `baseUrl` and `gateway` fields that would reveal proxy usage in analytics events

## Quick Start

One command. Requires Node.js 22+ and an existing Claude Code login on this machine.

```bash
git clone https://github.com/motiful/cc-gateway.git
cd cc-gateway
npm install
bash scripts/quick-setup.sh
```

This will:
1. Extract your OAuth credentials from macOS Keychain (access token + refresh token)
2. Generate a canonical device identity and client token
3. Write `config.yaml`
4. Generate a client launcher at `./clients/cc-<hostname>`
5. Start the gateway on `http://localhost:8443`

### Use it

In another terminal:

```bash
./clients/cc-<hostname>
```

That's it. Claude Code launches, traffic routes through the gateway. No env vars to set, no files to edit.

### Behind a proxy?

```bash
HTTPS_PROXY=http://127.0.0.1:7890 bash scripts/quick-setup.sh
```

The gateway will route all outbound traffic (API calls + token refresh) through your proxy.

## Add Clients

Each person gets their own launcher script with a unique token. The admin generates it:

```bash
bash scripts/add-client.sh alice
bash scripts/add-client.sh bob
```

This creates `./clients/cc-alice` and `./clients/cc-bob`. Send each file to the respective person.

### Client setup (what you tell them)

```bash
chmod +x cc-alice
./cc-alice install        # installs as 'ccg' command
ccg                       # start Claude Code through gateway
```

That's it. All Claude arguments work: `ccg --print "hello"`, `ccg --resume`, etc.

### Optional: make `claude` go through gateway too

```bash
ccg hijack                # alias claude → ccg (new terminals auto-apply)
claude                    # now goes through gateway
ccg release               # undo — restore native claude
```

### All commands

```
ccg                       Start Claude Code through gateway
ccg install               Install as 'ccg' system command
ccg uninstall             Remove 'ccg' and clean up
ccg hijack                Make 'claude' also go through gateway
ccg release               Restore 'claude' to native
ccg native [args]         Run native claude once (bypass gateway)
ccg status                Show gateway connection and hijack status
ccg help                  Show help
```

`ccg` and `claude` coexist by default. Hijack is opt-in and reversible. Supports zsh, bash, and fish.

## What Gets Rewritten

| Layer | Field | Action |
|-------|-------|--------|
| **Identity** | `device_id` in metadata + events | → canonical ID |
| | `email` | → canonical email |
| **Environment** | `env` object (40+ fields) | → entire object replaced |
| **Process** | `constrainedMemory` (physical RAM) | → canonical value |
| | `rss`, `heapTotal`, `heapUsed` | → randomized in realistic range |
| **Headers** | `User-Agent` | → canonical CC version |
| | `x-api-key` | → real OAuth token (injected by gateway) |
| | `x-anthropic-billing-header` | → stripped |
| | repeated request header values | → coalesced into one comma-separated value (TS parity) |
| **Prompt text** | `Platform`, `Shell`, `OS Version` | → canonical values |
| | `Working directory` | → canonical path |
| | `/Users/xxx/`, `/home/xxx/` | → canonical home prefix |
| **Billing** | `x-anthropic-billing-header` system block | → stripped entirely |
| **Leak fields** | `baseUrl` (ANTHROPIC_BASE_URL) | → stripped |
| | `gateway` (provider detection) | → stripped |

`canonical_profile.rewrite_policy` is active at runtime. `mode` supports `aggressive`, `conservative`, and `passthrough`; `strip_billing_header` controls billing-header removal; `normalize_timestamps` normalizes common event timestamp fields; and `preserve_fields` restores selected JSON paths from the original payload after rewriting.

## Deployment

### Local (development)

```bash
npm run dev    # tsx watch, auto-reload
```

### Docker (production)

```bash
bash scripts/admin-setup.sh
```

This interactive script:
1. Extracts OAuth credentials
2. Generates config + first client launcher
3. Builds and starts the Docker container
4. Asks for the gateway address clients should connect to

After setup, add more clients with:

```bash
bash scripts/add-client.sh <name>
# Restart to pick up new tokens:
docker compose restart
```

### Multi-machine deployment

```
Mac-A ──┐
Mac-B ──┼──→ gateway-server:8443 ──→ api.anthropic.com
Mac-C ──┘
```

**Important:** All machines — including the admin — should use the gateway. Direct connections from the admin machine would create a second device fingerprint visible to Anthropic.

For remote deployment, generate TLS certificates:

```bash
mkdir certs
openssl req -x509 -newkey rsa:2048 \
  -keyout certs/key.pem -out certs/cert.pem \
  -days 365 -nodes -subj "/CN=cc-gateway"
```

Uncomment the `tls` section in `config.yaml`, then generate client launchers pointing to the server address:

```bash
bash scripts/add-client.sh alice "" <gateway-ip>:8443 https
```

### Alternative: Tailscale (zero config networking)

If all devices have Tailscale installed, run the gateway on any machine in the mesh. No TLS needed (Tailscale encrypts the tunnel), no public IP needed, no port forwarding.

## Architecture

```
Client machines                        CC Gateway                    Anthropic
┌────────────┐                    ┌──────────────────┐
│ ./cc-alice  │── ANTHROPIC_ ────│  Auth: x-api-key  │
│  (launcher) │   BASE_URL       │  OAuth: auto-     │
│  + env vars │                  │    refresh        │──── single ────▶ api.anthropic.com
│             │                  │  Rewrite: all     │     identity
│             │                  │    identity       │
└────────────┘                    │  Strip: billing   │
                                  │    header         │
                                  │  Stream: SSE      │
                                  │    passthrough    │
                                  └──────────────────┘
                                         │
                                   platform.claude.com
                                   (token refresh only,
                                    from gateway IP)
```

**Defense in depth:**

| Layer | Mechanism | What it prevents |
|-------|-----------|-----------------|
| Launcher env vars | `ANTHROPIC_BASE_URL` + `DISABLE_NONESSENTIAL` + `ATTRIBUTION_HEADER=false` | CC voluntarily routes to gateway, disables side channels, skips billing hash |
| Clash (optional) | Domain-based REJECT rules | Any accidental or future direct connections to Anthropic |
| Gateway | Body + header + prompt rewriting | All 40+ fingerprint dimensions normalized to one device |

## OAuth Lifecycle

The gateway manages the full OAuth token lifecycle:

1. **Startup** — uses the existing access token from your keychain. Zero network calls.
2. **Auto-refresh** — 5 minutes before expiry, the gateway silently refreshes via `platform.claude.com`.
3. **Continuous** — refresh tokens rotate automatically. The gateway runs indefinitely without admin intervention.
4. **Failure recovery** — if a refresh fails, retries every 30 seconds. Only a refresh token expiry (rare, months) requires re-running `extract-token.sh`.

Clients never contact `platform.claude.com`. They send requests to the gateway with their client token; the gateway injects the real OAuth token before forwarding upstream.

## Clash Rules

Optional network-level safety net. Even if Claude Code bypasses env vars or adds new hardcoded endpoints in a future update, Clash blocks direct connections.

```yaml
rules:
  - DOMAIN,gateway.your-domain.com,DIRECT    # Allow gateway
  - DOMAIN-SUFFIX,anthropic.com,REJECT        # Block direct API
  - DOMAIN-SUFFIX,claude.com,REJECT           # Block OAuth
  - DOMAIN-SUFFIX,claude.ai,REJECT            # Block OAuth
  - DOMAIN-SUFFIX,datadoghq.com,REJECT        # Block telemetry
```

See [`clash-rules.yaml`](clash-rules.yaml) for the full template.

## Caveats

- **MCP servers** — `mcp-proxy.anthropic.com` is hardcoded and does not follow `ANTHROPIC_BASE_URL`. If clients use official MCP servers, those requests bypass the gateway. Use Clash to block this domain if MCP is not needed.
- **CC updates** — New Claude Code versions may introduce new telemetry fields or endpoints. Monitor Clash REJECT logs for unexpected connection attempts after upgrades.
- **Token lifecycle** — The gateway auto-refreshes the OAuth access token. If the underlying refresh token expires (rare), re-run `extract-token.sh` on the admin machine.

## Changelog

### v0.2.0 (2026-04-02)

**Billing header strategy overhaul**
- Stripped the `x-anthropic-billing-header` entirely (system prompt block + HTTP header) instead of rewriting the hash. This is consistent with the official `CLAUDE_CODE_ATTRIBUTION_HEADER=false` env var and enables cross-session prompt cache sharing (~85% cost reduction on system prompt).
- The CCH hash algorithm (reverse-engineered from `cli.js`) is implemented as a fallback but not active by default.

**Zero-login client setup**
- New `add-client.sh` generates self-contained launcher scripts (`./clients/cc-<name>`). Clients run one file — no `~/.zshrc` changes, no config files, no browser login.
- Launcher uses `ANTHROPIC_API_KEY` for gateway auth instead of the fragile `CLAUDE_CODE_OAUTH_TOKEN` + `ANTHROPIC_CUSTOM_HEADERS` approach.

**Instant gateway startup**
- OAuth now uses the existing access token from Keychain on launch. No network call until the token actually needs refreshing.
- `config.yaml` supports `access_token` + `expires_at` fields alongside `refresh_token`.

**Proxy support**
- Gateway respects `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` env vars for all outbound connections (API calls + token refresh).

**Observability**
- Connection-level request logging: every inbound request is logged with client IP before auth, and client name after auth.

**Admin tooling**
- `admin-setup.sh` — interactive Docker deployment with credential extraction and client generation.
- `quick-setup.sh` — one-command local setup that extracts full credentials (access + refresh + expiry).

### v0.1.0 (2026-04-01)

Initial release. Identity rewriting, environment normalization, centralized OAuth, SSE passthrough.

## References

This project builds on:

- [Claude Code 封号机制深度探查报告](https://bytedance.larkoffice.com/docx/E2JudVzf7oCNfhxyxaQcZIW1n0g) — Reverse-engineering analysis of Claude Code's 640+ telemetry events, 40+ fingerprint dimensions, and ban detection mechanisms
- [cc-cache-audit](https://github.com/motiful/cc-cache-audit) — A/B test proving the billing header breaks prompt cache sharing, with the one-line fix
- [instructkr/claude-code](https://github.com/instructkr/claude-code) — Deobfuscated Claude Code source used for the telemetry audit

## Star History

<div align="center">
  <a href="https://star-history.com/#motiful/cc-gateway&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=motiful/cc-gateway&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=motiful/cc-gateway&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=motiful/cc-gateway&type=Date" width="600" />
    </picture>
  </a>
</div>

## Why This Exists

I pay Anthropic $200/month. I have for almost a year.

I own a laptop, a desktop, and a tablet. Three devices, one person, one subscription. I logged into a fourth device and my account was banned. No warning. No explanation. No refund. No way to export my conversation history. No customer support to contact.

I'm not in the US. For non-US subscribers, there is no appeals process. The ban is permanent and silent.

This project is not a hack. It is not a crack. It does not bypass rate limits, share accounts, or steal service. It is a reverse proxy that makes my own devices — devices I already paid for access to — present a consistent identity to an API that I already pay for.

The technical approach is conservative by design:

- **Billing header**: stripped using the same official env var (`CLAUDE_CODE_ATTRIBUTION_HEADER=false`) that Anthropic built into their own code. Thousands of legitimate users already have this set.
- **Identity normalization**: all devices report the same device ID, email, and environment. This is indistinguishable from one person using one machine.
- **Fixed IP**: the gateway routes all traffic through a single static IP. Anthropic sees one device, one location, one user.
- **No evasion**: we don't fake locations, rotate IPs, or circumvent rate limits. If Anthropic's detection looks at this traffic, it looks normal — because it IS normal. One person using their subscription.

If Anthropic offered a way to manage multiple devices — a device dashboard, a family plan, a per-seat enterprise option — this tool would not need to exist. They don't. So it does.

## Disclaimer

This project is for educational and research purposes only.

- Do NOT use this to share accounts or violate Anthropic's Terms of Service
- Do NOT use this for commercial purposes
- The author is not responsible for any consequences of using this software
- Use at your own risk

## License

[MIT](LICENSE)

---

<div align="center">
  <sub>Crafted with <a href="https://github.com/anthropics/claude-code">Claude Code</a></sub>
</div>

<!-- Badge references -->
[license-shield]: https://img.shields.io/github/license/motiful/cc-gateway
[license-url]: https://github.com/motiful/cc-gateway/blob/main/LICENSE
[version-shield]: https://img.shields.io/badge/version-0.2.0--alpha-blue
[version-url]: https://github.com/motiful/cc-gateway/releases
[tests-shield]: https://img.shields.io/badge/tests-16%20passed-brightgreen
[tests-url]: https://github.com/motiful/cc-gateway/blob/main/tests/rewriter.test.ts
[twitter-shield]: https://img.shields.io/badge/follow-%40whiletrue0x-1DA1F2?logo=x&logoColor=white
[twitter-url]: https://x.com/whiletrue0x
