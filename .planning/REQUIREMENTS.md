# Requirements: CC Gateway

**Defined:** 2026-04-08
**Core Value:** Operators can run Claude Code through one trusted gateway that presents a stable canonical identity and does not leak surprising telemetry or operational state.

## v1 Requirements

### Gateway Hardening

- [ ] **GW-01**: Operator can proxy Claude Code requests through the Rust daemon with streaming responses and canonical rewrite behavior matching documented parity expectations.
- [ ] **GW-02**: Gateway rejects or safely bounds oversized rewrite-eligible request bodies instead of buffering unbounded payloads in memory.
- [ ] **GW-03**: Runtime differences between the TypeScript reference gateway and the Rust gateway are either covered by regression tests or explicitly documented as compatibility-only behavior.

### Desktop Operations

- [ ] **OPS-01**: Desktop status always reflects whether the managed daemon process is actually alive.
- [ ] **OPS-02**: Desktop health checks succeed for both HTTP and TLS-enabled local daemon configurations.
- [ ] **OPS-03**: Operator can recover from a daemon crash or failed start from the desktop app without stale running state.

### Secrets & Security

- [ ] **SEC-01**: Health and management surfaces can be configured to hide or protect upstream, client, and canonical-identity details from unauthenticated callers.
- [ ] **SEC-02**: Desktop renderer receives redacted config and proxy snapshots unless a targeted secret-edit action explicitly requires raw values.
- [ ] **SEC-03**: Local and desktop-first installs default to loopback-safe exposure or clearly warn before serving plaintext gateway traffic on non-local interfaces.

### Configuration Safety

- [ ] **CFG-01**: Saving daemon config from the desktop app is atomic and cannot delete the last known-good config on rename failures.
- [ ] **CFG-02**: Config validation failures explain what failed without corrupting the existing config file or daemon state.

### Verification & Tooling

- [ ] **QLT-01**: Default repository test commands exercise config parsing, production OAuth behavior, and desktop dashboard logic.
- [ ] **QLT-02**: Parity-sensitive rewrite flows have fixture-based tests for prompt, env, header, and metadata normalization.
- [ ] **QLT-03**: Desktop lifecycle regressions (TLS startup, post-start crash detection, log polling) have automated coverage or explicit manual UAT guidance.

## v2 Requirements

### Product Expansion

- **EXP-01**: Operator can manage gateway deployments through a richer authenticated admin surface beyond local desktop controls.
- **EXP-02**: Project supports additional upstream providers beyond Claude/Anthropic.
- **EXP-03**: Desktop app includes a full end-to-end automation harness for packaged-app workflows.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hosted multi-tenant cloud control plane | Not required for the current self-hosted/local operator model |
| Mobile companion application | Does not improve the gateway’s core telemetry-control value |
| Non-Anthropic provider support | Would dilute the current hardening/parity milestone |
| Database-backed persistent backend | Local file-based config is sufficient for the current architecture |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GW-01 | TBD | Pending |
| GW-02 | TBD | Pending |
| GW-03 | TBD | Pending |
| OPS-01 | TBD | Pending |
| OPS-02 | TBD | Pending |
| OPS-03 | TBD | Pending |
| SEC-01 | TBD | Pending |
| SEC-02 | TBD | Pending |
| SEC-03 | TBD | Pending |
| CFG-01 | TBD | Pending |
| CFG-02 | TBD | Pending |
| QLT-01 | TBD | Pending |
| QLT-02 | TBD | Pending |
| QLT-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after initialization*
