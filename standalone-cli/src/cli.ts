import { discoverCredentials } from './credential-discovery/discover.js'
import { readBootstrapManifest } from './environment/manifest.js'
import { prepareRuntimeEnvironment } from './environment/prepare.js'
import type { PreparedRuntimeSummary } from './environment/types.js'
import { launchClaude } from './launch/claude.js'
import {
  renderClaudeLaunchFailure,
  renderDiscoveryFailure,
  renderDiscoverySuccess,
  renderHelpText,
  renderPrepareRuntimeFailure,
  renderPrepareRuntimeSuccess,
} from './output.js'

const HELP_COMMANDS = new Set(['-h', '--help', 'help'])
const DISCOVER_CREDENTIALS_COMMAND = 'discover-credentials'
const PREPARE_RUNTIME_COMMAND = 'prepare-runtime'

export interface CliDependencies {
  discoverCredentials?: typeof discoverCredentials
  prepareRuntimeEnvironment?: typeof prepareRuntimeEnvironment
  readBootstrapManifest?: typeof readBootstrapManifest
  launchClaude?: typeof launchClaude
}

export function shouldRenderHelp(argv: string[]): boolean {
  return HELP_COMMANDS.has(argv[0] ?? '')
}

function deriveGatewayUrl(summary: PreparedRuntimeSummary): string {
  try {
    return new URL(summary.runtime.healthUrl).origin
  } catch {
    if (summary.runtime.port !== undefined) {
      return `http://127.0.0.1:${summary.runtime.port}`
    }

    throw new Error(`Prepared runtime health URL is invalid: ${summary.runtime.healthUrl}`)
  }
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const discover = dependencies.discoverCredentials ?? discoverCredentials
  const prepareRuntime = dependencies.prepareRuntimeEnvironment ?? prepareRuntimeEnvironment
  const readManifest = dependencies.readBootstrapManifest ?? readBootstrapManifest
  const handoffToClaude = dependencies.launchClaude ?? launchClaude

  if (shouldRenderHelp(argv)) {
    process.stdout.write(renderHelpText())
    return 0
  }

  if (argv[0] === DISCOVER_CREDENTIALS_COMMAND) {
    const result = await discover()

    if (result.ok) {
      process.stdout.write(renderDiscoverySuccess(result))
      return 0
    }

    process.stderr.write(renderDiscoveryFailure(result))
    return 1
  }

  if (argv[0] === PREPARE_RUNTIME_COMMAND) {
    if (argv.length > 1) {
      process.stderr.write(
        'prepare-runtime does not accept claude passthrough arguments in Phase 7; launch handoff starts in Phase 8.\n',
      )
      return 1
    }

    const result = await discover()

    if (!result.ok) {
      process.stderr.write(renderDiscoveryFailure(result))
      return 1
    }

    try {
      const summary = await prepareRuntime(result.credentials)
      process.stdout.write(renderPrepareRuntimeSuccess(summary))
      return 0
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(renderPrepareRuntimeFailure(message))
      return 1
    }
  }

  const result = await discover()

  if (!result.ok) {
    process.stderr.write(renderDiscoveryFailure(result))
    return 1
  }

  try {
    const summary = await prepareRuntime(result.credentials)
    const manifest = await readManifest(summary.bootstrap.workspacePaths)

    if (!manifest) {
      throw new Error(`Bootstrap manifest missing at ${summary.bootstrap.workspacePaths.manifestPath}`)
    }

    return await handoffToClaude({
      args: [...argv],
      clientToken: manifest.client.token,
      cwd: process.cwd(),
      env: process.env,
      gatewayUrl: deriveGatewayUrl(summary),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(renderClaudeLaunchFailure(message))
    return 1
  }
}
