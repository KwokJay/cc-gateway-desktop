import { discoverCredentials } from './credential-discovery/discover.js'
import { prepareRuntimeEnvironment } from './environment/prepare.js'
import {
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
  launchClaude?: (...args: unknown[]) => Promise<number> | number
}

export function shouldRenderHelp(argv: string[]): boolean {
  return argv.length === 0 || HELP_COMMANDS.has(argv[0] ?? '')
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const discover = dependencies.discoverCredentials ?? discoverCredentials
  const prepareRuntime = dependencies.prepareRuntimeEnvironment ?? prepareRuntimeEnvironment

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

  if (!shouldRenderHelp(argv)) {
    process.stderr.write(`Unknown command: ${argv[0]}\n`)
    process.stderr.write(renderHelpText())
    return 1
  }

  return 1
}
