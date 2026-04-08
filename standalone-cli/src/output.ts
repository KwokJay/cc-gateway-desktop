import type { DiscoveryFailure, DiscoverySuccess } from './credential-discovery/types.js'
import type { PreparedRuntimeSummary } from './environment/types.js'

function formatSource(source: DiscoverySuccess['source'] | DiscoveryFailure['source']): string {
  return source === 'macos-keychain' ? 'macOS Keychain' : 'credentials file'
}

function formatExpiry(expiresAt?: number): string {
  if (expiresAt === undefined) {
    return 'unknown'
  }

  return new Date(expiresAt).toISOString()
}

export function renderDiscoverySuccess(result: DiscoverySuccess): string {
  const emailLine = result.credentials.email ? `Email: ${result.credentials.email}\n` : ''

  return `Credential discovery: success

Source: ${formatSource(result.source)}
${emailLine}Access token: detected but hidden
Refresh token: detected but hidden
Expires at: ${formatExpiry(result.credentials.expiresAt)}
`
}

export function renderDiscoveryFailure(result: DiscoveryFailure): string {
  const nextSteps =
    result.reason === 'not-found' || result.reason === 'not-available'
      ? `Next step:
  Run \`claude\`
  Complete browser login
  Retry ccgw-standalone-cli discover-credentials
`
      : `Next step:
  Re-run \`claude\` and complete browser login if the saved credentials are stale
  Inspect the reported source for malformed JSON or missing claudeAiOauth.refreshToken data
`

  return `Credential discovery: failed

Source: ${formatSource(result.source)}
Reason: ${result.reason}
Detail: ${result.detail}
${nextSteps}`
}

export function renderHelpText(): string {
  return `CC Gateway Standalone CLI

Usage:
  ccgw-standalone-cli
  ccgw-standalone-cli help
  ccgw-standalone-cli -h
  ccgw-standalone-cli --help
  ccgw-standalone-cli discover-credentials
  ccgw-standalone-cli prepare-runtime

Phase 7 scope:
  - additive standalone scaffold with credential discovery and proxy-aware runtime preparation
  - does not replace src/, scripts/, crates/core/, crates/daemon/, crates/cli/, or crates/desktop/
  - excludes claude launch behavior and arbitrary passthrough arguments until Phase 8

Commands:
  discover-credentials  Check macOS Keychain first on darwin, then the credentials file fallback
  prepare-runtime       Create or reuse the standalone workspace, then wait for a healthy local gateway runtime

Package-local verification:
  - npm --prefix standalone-cli run build
  - npx tsx standalone-cli/tests/cli-help.test.ts
  - npx tsx standalone-cli/tests/credential-discovery.test.ts
  - npx tsx standalone-cli/tests/environment-bootstrap.test.ts
  - npx tsx standalone-cli/tests/proxy-env.test.ts
  - npx tsx standalone-cli/tests/runtime-preparation.test.ts
`
}

export function renderPrepareRuntimeSuccess(summary: PreparedRuntimeSummary): string {
  return `prepare-runtime: ready

Workspace: ${summary.bootstrap.workspacePaths.workspaceRoot}
Config path: ${summary.bootstrap.configPath}
Runtime action: ${summary.runtime.action}
Gateway health: ${summary.runtime.healthUrl}
`
}

export function renderPrepareRuntimeFailure(detail: string): string {
  return `prepare-runtime: failed

Detail: ${detail}
Next step:
  Check local proxy env, credentials, and gateway build output
  Retry ccgw-standalone-cli prepare-runtime
`
}
