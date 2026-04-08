import { strict as assert } from 'assert'

type CapturedRun = {
  exitCode: number
  stderr: string
  stdout: string
}

const { runCli } = await import(new URL('../src/cli.ts', import.meta.url).href)
const { renderHelpText } = await import(new URL('../src/output.ts', import.meta.url).href)

async function captureRun(argv: string[]): Promise<CapturedRun> {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  let stdout = ''
  let stderr = ''

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    const exitCode = await runCli(argv)
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

function assertHelpContract(helpText: string): void {
  assert.ok(helpText.includes('additive standalone scaffold with credential discovery and proxy-aware runtime preparation'))
  assert.ok(
    helpText.includes(
      'does not replace src/, scripts/, crates/core/, crates/daemon/, crates/cli/, or crates/desktop/',
    ),
  )
  assert.ok(helpText.includes('npm --prefix standalone-cli run build'))
  assert.ok(helpText.includes('npx tsx standalone-cli/tests/cli-help.test.ts'))
  assert.ok(helpText.includes('npx tsx standalone-cli/tests/credential-discovery.test.ts'))
  assert.ok(helpText.includes('npx tsx standalone-cli/tests/environment-bootstrap.test.ts'))
  assert.ok(helpText.includes('npx tsx standalone-cli/tests/proxy-env.test.ts'))
  assert.ok(helpText.includes('npx tsx standalone-cli/tests/runtime-preparation.test.ts'))
  assert.ok(helpText.includes('prepare-runtime'))
  assert.ok(helpText.includes('excludes claude launch behavior and arbitrary passthrough arguments until Phase 8'))
  assert.ok(!helpText.includes('replaces the legacy TypeScript gateway'))
}

const renderedHelp = renderHelpText()
assertHelpContract(renderedHelp)

for (const argv of [[], ['help'], ['-h'], ['--help']]) {
  const result = await captureRun(argv)
  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, renderedHelp)
}

console.log('cli-help.test.ts: ok')
