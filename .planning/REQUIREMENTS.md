# Requirements: CC Gateway

**Defined:** 2026-04-08
**Core Value:** Operators can run Claude Code through one trusted gateway that presents a stable canonical identity and does not leak surprising telemetry or operational state.

## v1 Requirements

### Capability Analysis

- [x] **ANA-01**: Operator can read a checked-in inventory of the TypeScript backend's runtime, setup, auth, config, and launch capabilities that matter to the new CLI.
- [x] **ANA-02**: Each analyzed TypeScript capability is classified as must-port, reference-only, or deferred for the new CLI milestone.

### Environment Bootstrap

- [x] **ENV-01**: Operator can run the new standalone CLI on a machine with an existing Claude Code login and have it detect usable local Claude OAuth credentials from supported local sources or receive an actionable failure message.
- [x] **ENV-02**: New CLI can generate or reuse canonical identity, client token, and local config or workspace artifacts needed for a local Claude-through-gateway session without editing the existing TypeScript or Rust applications.
- [x] **ENV-03**: Re-running the new CLI on the same machine is idempotent and does not duplicate or corrupt previously generated bootstrap artifacts.
- [x] **ENV-04**: New CLI honors local outbound proxy settings expressed through the existing `HTTPS_PROXY` / `HTTP_PROXY` style environment variables.
- [x] **ENV-05**: New CLI prepares or starts the local runtime state required by the generated environment before Claude Code launch begins.

### Claude Launch

- [ ] **RUN-01**: After environment bootstrap succeeds, the new CLI locates the locally installed `claude` executable and launches it automatically.
- [ ] **RUN-02**: The launched Claude process receives `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, and `CLAUDE_CODE_ATTRIBUTION_HEADER=false` without requiring manual operator setup.
- [ ] **RUN-03**: Arbitrary Claude command-line arguments pass through the new CLI unchanged.
- [ ] **RUN-04**: If Claude Code is not installed or cannot be executed, the new CLI exits with actionable installation or PATH guidance instead of reporting partial success.

### Isolation & Verification

- [x] **ISO-01**: Existing TypeScript gateway files, setup scripts, Rust daemon, Rust CLI, and desktop app remain behaviorally and structurally unchanged by the new CLI milestone.
- [x] **ISO-02**: The new CLI lives in an isolated path or package with its own entrypoint and documentation, so operators can adopt it without affecting current TS or Rust flows.
- [ ] **QLT-01**: Automated tests cover capability inventory classification, credential detection decisions, bootstrap artifact generation, and Claude launch environment preparation without requiring live OAuth traffic.
- [ ] **QLT-02**: Checked-in operator guidance covers first-run bootstrap, repeat-run behavior, and recovery paths for missing credentials or missing `claude`.

## v2 Requirements

### Future Expansion

- **EXP-01**: New bootstrap CLI can manage multi-machine or multi-user client distribution flows.
- **EXP-02**: New bootstrap CLI can optionally integrate with the existing desktop app for guided onboarding.
- **EXP-03**: New bootstrap CLI can replace or consolidate with the Rust `ccg` launcher after parity is proven.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting the existing TypeScript gateway or Rust programs | User explicitly asked for those codepaths to remain unchanged |
| Hosted admin or remote orchestration layer | Milestone targets one local machine preparing its own Claude Code environment |
| Non-Anthropic provider bootstrap | Current request remains Claude Code and Anthropic specific |
| Desktop-first onboarding flow | Milestone is terminal-first CLI work |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANA-01 | Phase 5 | Complete |
| ANA-02 | Phase 5 | Complete |
| ISO-01 | Phase 5 | Complete |
| ENV-01 | Phase 6 | Complete |
| ISO-02 | Phase 6 | Complete |
| ENV-02 | Phase 7 | Complete |
| ENV-03 | Phase 7 | Complete |
| ENV-04 | Phase 7 | Complete |
| ENV-05 | Phase 7 | Complete |
| RUN-01 | Phase 8 | Pending |
| RUN-02 | Phase 8 | Pending |
| RUN-03 | Phase 8 | Pending |
| RUN-04 | Phase 8 | Pending |
| QLT-01 | Phase 9 | Pending |
| QLT-02 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after completing ENV-01*
