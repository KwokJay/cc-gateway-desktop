import { EventEmitter } from 'events'

export interface LaunchSpyOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  shell?: boolean
  stdio?: string
}

export interface LaunchSpyCall {
  command: string
  args: string[]
  options: LaunchSpyOptions
}

export interface LaunchSpyOutcome {
  error?: NodeJS.ErrnoException
  exitCode?: number | null
  signal?: NodeJS.Signals | null
  pid?: number
}

type LaunchSpyChild = EventEmitter & {
  pid?: number
  kill(): void
  unref(): void
}

function cloneEnv(env: LaunchSpyOptions['env']): Record<string, string | undefined> {
  return env ? { ...env } : {}
}

export function createLaunchError(
  code: 'EACCES' | 'ENOENT',
  message = `spawn claude ${code}`,
): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException
  error.code = code
  error.path = 'claude'
  error.syscall = 'spawn claude'
  return error
}

export function createLaunchSpy(outcome: LaunchSpyOutcome = {}) {
  const calls: LaunchSpyCall[] = []

  return {
    calls,
    spawn(command: string, args: string[], options: LaunchSpyOptions = {}): LaunchSpyChild {
      calls.push({
        command,
        args: [...args],
        options: {
          ...options,
          env: cloneEnv(options.env),
        },
      })

      const child = new EventEmitter() as LaunchSpyChild
      child.pid = outcome.pid ?? 4242
      child.kill = () => {}
      child.unref = () => {}

      queueMicrotask(() => {
        if (outcome.error) {
          child.emit('error', outcome.error)
          return
        }

        child.emit('exit', outcome.exitCode ?? 0, outcome.signal ?? null)
      })

      return child
    },
  }
}
