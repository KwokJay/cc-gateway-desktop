import { strict as assert } from 'assert'
import { readFileSync } from 'fs'

import { discoverCredentials } from '../src/credential-discovery/discover.js'
import { parseCredentialPayload } from '../src/credential-discovery/parse.js'
import { renderDiscoveryFailure, renderDiscoverySuccess } from '../src/output.js'
import type { DiscoveryFailure, DiscoverySource } from '../src/credential-discovery/types.js'

function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/credential-discovery/${name}`, import.meta.url), 'utf8')
}

function notFound(source: DiscoverySource, detail: string): DiscoveryFailure {
  return {
    ok: false,
    source,
    reason: 'not-found',
    detail,
  }
}

const keychainFixture = readFixture('keychain-valid.json')
const fileFixture = readFixture('file-valid.json')

{
  const callOrder: DiscoverySource[] = []

  const result = await discoverCredentials({
    platform: 'darwin',
    readKeychain: async () => {
      callOrder.push('macos-keychain')
      return { ok: true, source: 'macos-keychain', raw: keychainFixture }
    },
    readCredentialsFile: async () => {
      callOrder.push('credentials-file')
      return { ok: true, source: 'credentials-file', raw: fileFixture }
    },
  })

  assert.deepEqual(callOrder, ['macos-keychain'])
  assert.equal(result.ok, true)
  assert.equal(result.source, 'macos-keychain')

  if (result.ok) {
    assert.equal(result.credentials.accessToken, 'sk-ant-keychain-access-1234567890')
    assert.equal(result.credentials.refreshToken, 'rt-ant-keychain-refresh-1234567890')
    assert.equal(result.credentials.expiresAt, 1760000000000)
    assert.equal(result.credentials.email, 'keychain-user@example.com')
  }
}

{
  const callOrder: DiscoverySource[] = []

  const result = await discoverCredentials({
    platform: 'darwin',
    readKeychain: async () => {
      callOrder.push('macos-keychain')
      return notFound('macos-keychain', 'Keychain entry not found for current user')
    },
    readCredentialsFile: async () => {
      callOrder.push('credentials-file')
      return { ok: true, source: 'credentials-file', raw: fileFixture }
    },
  })

  assert.deepEqual(callOrder, ['macos-keychain', 'credentials-file'])
  assert.equal(result.ok, true)
  assert.equal(result.source, 'credentials-file')

  if (result.ok) {
    assert.equal(result.credentials.accessToken, 'sk-ant-file-access-0987654321')
    assert.equal(result.credentials.refreshToken, 'rt-ant-file-refresh-0987654321')
    assert.equal(result.credentials.expiresAt, 1770000000000)
    assert.equal(result.credentials.email, 'file-user@example.com')
  }
}

{
  const malformed = parseCredentialPayload('credentials-file', '{"claudeAiOauth":')
  assert.equal(malformed.ok, false)
  assert.equal(malformed.reason, 'parse-error')
  assert.match(malformed.detail, /malformed JSON/i)

  const missingRefresh = parseCredentialPayload(
    'credentials-file',
    JSON.stringify({
      claudeAiOauth: {
        accessToken: 'sk-ant-missing-refresh',
        expiresAt: 1780000000000,
      },
    }),
  )

  assert.equal(missingRefresh.ok, false)
  assert.equal(missingRefresh.reason, 'invalid-credentials')
  assert.match(missingRefresh.detail, /refreshToken/i)
}

{
  const failure = await discoverCredentials({
    platform: 'linux',
    readCredentialsFile: async () => notFound('credentials-file', 'credentials file not found at fallback path'),
  })

  assert.equal(failure.ok, false)
  assert.equal(failure.source, 'credentials-file')
  assert.equal(failure.reason, 'not-found')

  const renderedFailure = renderDiscoveryFailure(failure)
  assert.match(renderedFailure, /Run `claude`/i)
  assert.match(renderedFailure, /browser login/i)
  assert.match(renderedFailure, /credentials file/i)
}

{
  const success = await discoverCredentials({
    platform: 'linux',
    readCredentialsFile: async () => ({ ok: true, source: 'credentials-file', raw: fileFixture }),
  })

  assert.equal(success.ok, true)

  if (!success.ok) {
    throw new Error('Expected fixture discovery to succeed')
  }

  const renderedSuccess = renderDiscoverySuccess(success)

  for (const secret of [
    'sk-ant-file-access-0987654321',
    'rt-ant-file-refresh-0987654321',
    'sk-ant-keychain-access-1234567890',
    'rt-ant-keychain-refresh-1234567890',
  ]) {
    assert.equal(renderedSuccess.includes(secret), false, 'secret-safe success output must not leak raw tokens')
  }

  const renderedFailure = renderDiscoveryFailure({
    ok: false,
    source: 'credentials-file',
    reason: 'invalid-credentials',
    detail: 'refreshToken missing from parsed credentials file payload',
  })

  for (const secret of [
    'sk-ant-file-access-0987654321',
    'rt-ant-file-refresh-0987654321',
    'sk-ant-keychain-access-1234567890',
    'rt-ant-keychain-refresh-1234567890',
  ]) {
    assert.equal(renderedFailure.includes(secret), false, 'secret-safe failure output must not leak raw tokens')
  }
}

console.log('credential-discovery.test.ts: ok')
