import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(packageRoot, '..')
const repoDistDir = resolve(repoRoot, 'dist')
const packageGatewayDir = resolve(packageRoot, 'dist', 'gateway')
const EXCLUDED_TOP_LEVEL = new Set(['standalone-cli'])

async function runCommand(command, args, cwd) {
  await new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    })

    child.once('error', rejectCommand)
    child.once('exit', (code) => {
      if (code === 0) {
        resolveCommand()
        return
      }

      rejectCommand(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function copyTree(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (EXCLUDED_TOP_LEVEL.has(entry.name) && sourceDir === repoDistDir) {
      continue
    }

    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath)
      continue
    }

    if (entry.isFile()) {
      await mkdir(dirname(targetPath), { recursive: true })
      await copyFile(sourcePath, targetPath)
    }
  }
}

async function main() {
  await runCommand('npm', ['run', 'build'], repoRoot)

  const distStats = await stat(repoDistDir).catch(() => null)
  if (!distStats?.isDirectory()) {
    throw new Error(`Root gateway dist directory is missing at ${repoDistDir}`)
  }

  await rm(packageGatewayDir, { recursive: true, force: true })
  await copyTree(repoDistDir, packageGatewayDir)

  const copiedEntrypoint = resolve(packageGatewayDir, 'index.js')
  const entrypointStats = await stat(copiedEntrypoint).catch(() => null)
  if (!entrypointStats?.isFile()) {
    throw new Error(
      `Gateway bundle entrypoint was not copied to ${copiedEntrypoint} from ${relative(packageRoot, repoDistDir)}`,
    )
  }
}

await main()
