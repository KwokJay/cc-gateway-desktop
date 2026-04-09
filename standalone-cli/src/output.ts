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
  Retry ccgw discover-credentials
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
  return `ccgw

Usage:
  ccgw [claude args]
  ccgw help
  ccgw -h
  ccgw --help
  ccgw discover-credentials
  ccgw prepare-runtime

Package scope:
  - global npm package for Claude launch handoff after credential discovery and proxy-aware runtime preparation
  - does not replace src/, scripts/, crates/core/, crates/daemon/, crates/cli/, or crates/desktop/
  - launch the locally installed claude executable after runtime preparation succeeds

Commands:
  discover-credentials  Check macOS Keychain first on darwin, then the credentials file fallback
  prepare-runtime       Create or reuse the standalone workspace, then wait for a healthy local gateway runtime

Package-local verification:
  - npm --prefix standalone-cli run build
  - npm --prefix standalone-cli run test:launch
  - npx tsx standalone-cli/tests/cli-help.test.ts
  - npx tsx standalone-cli/tests/credential-discovery.test.ts
  - npx tsx standalone-cli/tests/environment-bootstrap.test.ts
  - npx tsx standalone-cli/tests/proxy-env.test.ts
  - npx tsx standalone-cli/tests/runtime-preparation.test.ts
  - npx tsx standalone-cli/tests/claude-launch.test.ts

package-local launch verification:
  - bare invocation and ccgw [claude args] prepare the runtime first, then exec claude with unchanged argv
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
  Retry ccgw prepare-runtime
`
}

export function renderPrepareRuntimeLaunchPrompt(detail: string): string {
  return `prepare-runtime: failed before Claude launch

Detail: ${detail}

Skip and continue? (y/n)
`
}

export function renderPrepareRuntimeLaunchSkipNotice(): string {
  return 'prepare-runtime: skipping runtime-preparation failure and attempting Claude launch anyway\n'
}

export function renderPrepareRuntimeLaunchRejectNotice(): string {
  return 'prepare-runtime: launch rejected by user; exiting without starting Claude\n'
}

export function renderClaudeLaunchFailure(detail: string): string {
  return `claude launch: failed

Detail: ${detail}
Next step:
  Install Claude Code if needed: npm install -g @anthropic-ai/claude-code
  Open a new shell and confirm claude --help works from PATH
  Retry ccgw [claude args]
`
}
