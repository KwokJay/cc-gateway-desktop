import { access, mkdir, mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

export interface TempWorkspace {
  rootDir: string
  fakeHomeDir: string
  repoRoot: string
  cleanup(): Promise<void>
  exists(path: string): Promise<boolean>
  readText(path: string): Promise<string>
  readJson<T>(path: string): Promise<T>
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function createTempWorkspace(): Promise<TempWorkspace> {
  const rootDir = await mkdtemp(join(tmpdir(), 'ccgw-standalone-cli-'))
  const fakeHomeDir = join(rootDir, 'fake-home')
  const repoRoot = join(rootDir, 'repo-root')

  await mkdir(fakeHomeDir, { recursive: true })
  await mkdir(repoRoot, { recursive: true })

  return {
    rootDir,
    fakeHomeDir,
    repoRoot,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true })
    },
    async exists(path: string) {
      return pathExists(path)
    },
    async readText(path: string) {
      return readFile(path, 'utf8')
    },
    async readJson<T>(path: string) {
      return JSON.parse(await readFile(path, 'utf8')) as T
    },
  }
}

export async function withTempWorkspace<T>(run: (workspace: TempWorkspace) => Promise<T>): Promise<T> {
  const workspace = await createTempWorkspace()

  try {
    return await run(workspace)
  } finally {
    await workspace.cleanup()
  }
}

export async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}
