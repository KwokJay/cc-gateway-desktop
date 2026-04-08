import { discoverCredentials } from './credential-discovery/discover.js'
import { renderDiscoveryFailure, renderDiscoverySuccess, renderHelpText } from './output.js'

const HELP_COMMANDS = new Set(['-h', '--help', 'help'])
const DISCOVER_CREDENTIALS_COMMAND = 'discover-credentials'

export function shouldRenderHelp(argv: string[]): boolean {
  return argv.length === 0 || HELP_COMMANDS.has(argv[0] ?? '')
}

export async function runCli(argv: string[]): Promise<number> {
  if (shouldRenderHelp(argv)) {
    process.stdout.write(renderHelpText())
    return 0
  }

  if (argv[0] === DISCOVER_CREDENTIALS_COMMAND) {
    const result = await discoverCredentials()

    if (result.ok) {
      process.stdout.write(renderDiscoverySuccess(result))
      return 0
    }

    process.stderr.write(renderDiscoveryFailure(result))
    return 1
  }

  if (!shouldRenderHelp(argv)) {
    process.stderr.write(`Unknown command: ${argv[0]}\n`)
    process.stderr.write(renderHelpText())
    return 1
  }

  return 1
}
