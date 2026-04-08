export function renderHelpText(): string {
  return `CC Gateway Standalone CLI

Usage:
  ccgw-standalone-cli
  ccgw-standalone-cli help
  ccgw-standalone-cli -h
  ccgw-standalone-cli --help

Phase 6 scope:
  - additive standalone scaffold plus credential discovery only
  - does not replace src/, scripts/, crates/core/, crates/daemon/, crates/cli/, or crates/desktop/
  - excludes proxy startup, config generation, runtime preparation, and claude launch behavior

Package-local verification:
  - npm --prefix standalone-cli run build
  - npx tsx standalone-cli/tests/cli-help.test.ts
  - npx tsx standalone-cli/tests/credential-discovery.test.ts
`
}
