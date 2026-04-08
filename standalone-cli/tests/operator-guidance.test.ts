import { strict as assert } from 'assert'
import { readFileSync } from 'fs'

function readDoc(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function assertIncludesAll(text: string, expected: string[], label: string): void {
  for (const value of expected) {
    assert.ok(text.includes(value), `${label} must include ${value}`)
  }
}

function assertExcludesAll(text: string, rejected: Array<string | RegExp>, label: string): void {
  for (const value of rejected) {
    if (typeof value === 'string') {
      assert.equal(text.includes(value), false, `${label} must not include ${value}`)
      continue
    }

    assert.equal(value.test(text), false, `${label} must not match ${value}`)
  }
}

function assertIncludesAny(text: string, expected: string[], label: string): void {
  assert.ok(expected.some((value) => text.includes(value)), `${label} must include one of: ${expected.join(', ')}`)
}

const readme = readDoc('../README.md')
const repoDoc = readDoc('../../docs/standalone-cli.md')

assertIncludesAll(
  readme,
  [
    'ccgw-standalone-cli [claude args]',
    'ccgw-standalone-cli discover-credentials',
    'ccgw-standalone-cli prepare-runtime',
    'npm --prefix standalone-cli test',
    '~/.ccgw/standalone-cli/manifest.json',
    '~/.ccgw/standalone-cli/config.yaml',
    '~/.ccgw/standalone-cli/runtime.json',
  ],
  'standalone-cli/README.md',
)

assertIncludesAny(
  readme,
  [
    'first run',
    'first-run',
  ],
  'standalone-cli/README.md first-run guidance',
)

assertIncludesAny(
  readme,
  [
    'repeat run',
    'repeat-run',
    'rerun',
    're-run',
  ],
  'standalone-cli/README.md repeat-run guidance',
)

assertIncludesAny(
  readme,
  [
    'create or reuse the standalone workspace and config',
    'create or reuse the standalone workspace',
    'reuse the standalone workspace',
  ],
  'standalone-cli/README.md workspace reuse guidance',
)

assertIncludesAny(
  readme,
  [
    'refreshing OAuth values',
    'refresh OAuth values',
    'refresh OAuth',
    'refresh_token',
  ],
  'standalone-cli/README.md rerun refresh guidance',
)

assertIncludesAny(
  readme,
  [
    'Run `claude`',
    'run `claude`',
  ],
  'standalone-cli/README.md missing-credentials recovery',
)

assertIncludesAny(
  readme,
  [
    'Complete browser login',
    'complete browser login',
  ],
  'standalone-cli/README.md missing-credentials recovery',
)

assertIncludesAny(
  readme,
  [
    'Retry ccgw-standalone-cli discover-credentials',
    'Retry `ccgw-standalone-cli discover-credentials`',
    'Retry ccgw-standalone-cli',
    'Retry `ccgw-standalone-cli`',
  ],
  'standalone-cli/README.md missing-credentials retry guidance',
)

assertIncludesAll(
  readme,
  [
    'Install Claude Code if needed: npm install -g @anthropic-ai/claude-code',
    'Open a new shell and confirm claude --help works from PATH',
    'Retry ccgw-standalone-cli [claude args]',
  ],
  'standalone-cli/README.md missing-claude recovery',
)

assertExcludesAll(
  readme,
  [
    /sk-ant-/i,
    /rt-ant-/i,
    /access token:\s+\S+/i,
    /refresh token:\s+\S+/i,
    /client token:\s+\S+/i,
  ],
  'standalone-cli/README.md secret-safe guidance',
)

assertIncludesAny(
  repoDoc,
  [
    'standalone-cli/README.md',
    '`standalone-cli/README.md`',
  ],
  'docs/standalone-cli.md canonical pointer',
)

assertIncludesAny(
  repoDoc,
  [
    'canonical operator guide',
    'authoritative runbook',
    'authoritative guide',
  ],
  'docs/standalone-cli.md authority handoff',
)

assertIncludesAny(
  repoDoc,
  [
    'additive',
    'does not replace',
  ],
  'docs/standalone-cli.md additive boundary',
)

assertExcludesAll(
  repoDoc,
  [
    'src/standalone-cli',
    '~/.ccg-local-cli',
    'setup',
    'status',
    'start the TypeScript gateway logic in-process',
  ],
  'docs/standalone-cli.md stale markers',
)

assertExcludesAll(
  repoDoc,
  [
    /sk-ant-/i,
    /rt-ant-/i,
    /client-token/i,
  ],
  'docs/standalone-cli.md secret-safe guidance',
)

console.log('operator-guidance.test.ts: ok')
