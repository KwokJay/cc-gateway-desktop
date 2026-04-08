import { strict as assert } from 'assert'
import { readdirSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const testsDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = dirname(testsDir)
const tsxCliPath = require.resolve('tsx/cli')
const TEST_FILE_SUFFIX = '.test.ts'
const EXCLUDED_SEGMENTS = new Set(['fixtures', 'helpers'])

function collectTestFiles(rootDir: string): string[] {
  const testFiles: string[] = []
  const pending = [rootDir]

  while (pending.length > 0) {
    const currentDir = pending.pop()
    assert.ok(currentDir, 'test directory walk must always have a directory to inspect')

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = join(currentDir, entry.name)
      const relativePath = relative(rootDir, entryPath)
      const segments = relativePath.split(/[\\/]/).filter(Boolean)

      if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
        continue
      }

      if (entry.isDirectory()) {
        pending.push(entryPath)
        continue
      }

      if (entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX)) {
        testFiles.push(entryPath)
      }
    }
  }

  return testFiles.sort((left, right) => left.localeCompare(right))
}

const testFiles = collectTestFiles(testsDir)

assert.ok(testFiles.length > 0, 'run-all requires at least one package-local *.test.ts file')

for (const testFile of testFiles) {
  const label = relative(packageRoot, testFile)
  console.log(`run-all.ts: ${label}`)

  const result = spawnSync(process.execPath, [tsxCliPath, testFile], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  if (result.signal) {
    throw new Error(`Test exited from signal: ${label} (${result.signal})`)
  }
}

console.log('run-all.ts: ok')
