# Milestone Research: Pitfalls

## Main Risks

- **Bootstrap/launch split without runtime readiness**: launching `claude` before the prepared local environment is actually usable would create a confusing half-working CLI.
- **Credential source fragility**: macOS Keychain and `~/.claude/.credentials.json` can diverge; the CLI needs a deterministic precedence order and explicit failure messages.
- **Accidental edits to legacy codepaths**: the user explicitly asked to keep TS and Rust programs unchanged, so shared-file edits are a milestone failure mode.
- **Non-idempotent setup**: repeated runs must not duplicate tokens, corrupt config, or leave multiple competing launcher artifacts.
- **PATH assumptions**: `claude` may be missing, renamed, or installed outside the default PATH.

## Prevention Strategy

- Separate capability inventory from implementation so the new CLI copies only the necessary behaviors.
- Treat credential detection, artifact generation, and launch as explicit phases with independent tests.
- Keep bootstrap artifacts under a dedicated new CLI-owned path or package boundary.
- Add manual UAT for first-run, repeat-run, missing-credential, and missing-`claude` scenarios.

## Which Phase Should Address What

- **Phase 5**: prevent scope drift by locking the TS feature inventory and isolation boundary
- **Phase 6**: prevent credential-source ambiguity and accidental legacy-file edits
- **Phase 7**: prevent non-idempotent environment construction and runtime-readiness gaps
- **Phase 8**: prevent launch-path and argument-pass-through regressions
- **Phase 9**: prevent silent regressions through automated checks and operator guidance
