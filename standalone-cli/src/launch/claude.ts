import { spawn, type ChildProcess } from 'child_process'

export interface BuildClaudeLaunchEnvInput {
  baseEnv?: NodeJS.ProcessEnv
  gatewayUrl: string
  clientToken: string
}

export interface ClaudeLaunchRequest {
  args: string[]
  clientToken: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  gatewayUrl: string
  spawnImpl?: SpawnLike
}

export interface ClaudeSpawnOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell: false
  stdio: 'inherit'
}

type SpawnLikeChild = Pick<ChildProcess, 'once' | 'pid'>
type SpawnLike = (command: string, args: string[], options: ClaudeSpawnOptions) => SpawnLikeChild

function normalizeLaunchError(error: unknown): Error {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'ENOENT') {
      return new Error(
        'claude was not found in PATH. Install Claude Code with `npm install -g @anthropic-ai/claude-code`, then open a new shell so PATH is refreshed.',
      )
    }

    if (error.code === 'EACCES') {
      return new Error(
        'claude could not be executed from PATH. Check executable permissions, confirm `claude --help` works, then retry the standalone CLI.',
      )
    }
  }

  return error instanceof Error ? error : new Error(String(error))
}

export function buildClaudeLaunchEnv(input: BuildClaudeLaunchEnvInput): NodeJS.ProcessEnv {
  return {
    ...(input.baseEnv ?? process.env),
    ANTHROPIC_BASE_URL: input.gatewayUrl,
    ANTHROPIC_API_KEY: input.clientToken,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: 'false',
  }
}

export async function launchClaude(input: ClaudeLaunchRequest): Promise<number> {
  const spawnImpl = input.spawnImpl ?? spawn

  return new Promise<number>((resolveLaunch, rejectLaunch) => {
    const child = spawnImpl('claude', input.args, {
      cwd: input.cwd,
      env: buildClaudeLaunchEnv({
        baseEnv: input.env,
        gatewayUrl: input.gatewayUrl,
        clientToken: input.clientToken,
      }),
      shell: false,
      stdio: 'inherit',
    })

    child.once('error', (error) => {
      rejectLaunch(normalizeLaunchError(error))
    })

    child.once('exit', (code) => {
      resolveLaunch(code ?? 1)
    })
  })
}
