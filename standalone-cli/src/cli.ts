import { renderHelpText } from './output.js'

const HELP_COMMANDS = new Set(['-h', '--help', 'help'])

export function shouldRenderHelp(argv: string[]): boolean {
  return argv.length === 0 || HELP_COMMANDS.has(argv[0] ?? '')
}

export async function runCli(argv: string[]): Promise<number> {
  if (!shouldRenderHelp(argv)) {
    process.stderr.write(`Unknown command: ${argv[0]}\n`)
    process.stderr.write(renderHelpText())
    return 1
  }

  process.stdout.write(renderHelpText())
  return 0
}
