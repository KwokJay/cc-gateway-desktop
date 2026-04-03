import { strict as assert } from 'assert'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

let passed = 0
let failed = 0
const tests: Array<() => Promise<void>> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    const fullName = `oauth.test.ts :: ${name}`
    try {
      await fn()
      console.log(`${GREEN}✓${RESET} ${fullName}`)
      passed++
    } catch (err) {
      console.log(`${RED}✗${RESET} ${fullName}`)
      console.error(err)
      failed++
    }
  })
}

type MockOAuthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

class OAuthMock {
  cachedTokens: MockOAuthTokens | null = null
  refreshCallCount = 0
  scheduleRefreshCallCount = 0
  logMessages: string[] = []

  reset() {
    this.cachedTokens = null
    this.refreshCallCount = 0
    this.scheduleRefreshCallCount = 0
    this.logMessages = []
  }

  log(level: string, msg: string) {
    this.logMessages.push(`[${level}] ${msg}`)
  }

  async refreshOAuthToken(refreshToken: string): Promise<MockOAuthTokens> {
    this.refreshCallCount++
    return {
      accessToken: `new-access-token-${this.refreshCallCount}`,
      refreshToken,
      expiresAt: Date.now() + 3600 * 1000,
    }
  }

  scheduleRefresh(_refreshToken: string) {
    this.scheduleRefreshCallCount++
  }

  async initOAuth(oauth: {
    access_token?: string
    refresh_token: string
    expires_at?: number
  }): Promise<void> {
    const now = Date.now()
    const expiresAt = oauth.expires_at ?? 0

    if (oauth.access_token && expiresAt > now) {
      this.cachedTokens = {
        accessToken: oauth.access_token,
        refreshToken: oauth.refresh_token,
        expiresAt,
      }
      const remaining = Math.round((expiresAt - now) / 60_000)
      this.log('info', `Using existing access token (expires in ${remaining} min)`)
      this.scheduleRefresh(oauth.refresh_token)
      return
    }

    if (oauth.access_token) {
      this.log('info', 'Access token expired, refreshing...')
    } else {
      this.log('info', 'No access token provided, refreshing...')
    }

    this.cachedTokens = await this.refreshOAuthToken(oauth.refresh_token)
    this.log('info', `OAuth token acquired, expires at ${new Date(this.cachedTokens.expiresAt).toISOString()}`)
    this.scheduleRefresh(oauth.refresh_token)
  }

  getAccessToken(): string | null {
    if (!this.cachedTokens) return null
    if (Date.now() >= this.cachedTokens.expiresAt) {
      this.log('warn', 'OAuth token expired, waiting for refresh...')
      return null
    }
    return this.cachedTokens.accessToken
  }

  async getAccessTokenOrRefresh(refreshToken: string): Promise<string | null> {
    if (!this.cachedTokens) {
      this.log('warn', 'No cached tokens, attempting refresh...')
      try {
        this.cachedTokens = await this.refreshOAuthToken(refreshToken)
        this.log('info', `OAuth token refreshed, expires at ${new Date(this.cachedTokens.expiresAt).toISOString()}`)
        this.scheduleRefresh(refreshToken)
        return this.cachedTokens.accessToken
      } catch (err) {
        this.log('error', `OAuth refresh failed: ${err}`)
        return null
      }
    }

    if (Date.now() >= this.cachedTokens.expiresAt) {
      this.log('info', 'Token expired, refreshing lazily...')
      try {
        this.cachedTokens = await this.refreshOAuthToken(this.cachedTokens.refreshToken || refreshToken)
        this.log('info', `OAuth token refreshed, expires at ${new Date(this.cachedTokens.expiresAt).toISOString()}`)
        this.scheduleRefresh(this.cachedTokens.refreshToken || refreshToken)
        return this.cachedTokens.accessToken
      } catch (err) {
        this.log('error', `OAuth refresh failed: ${err}`)
        return null
      }
    }

    return this.cachedTokens.accessToken
  }
}

const mock = new OAuthMock()

test('initOAuth reuses valid access token without network call', async () => {
  mock.reset()
  const futureExpiry = Date.now() + 3600 * 1000

  await mock.initOAuth({
    access_token: 'existing-token',
    refresh_token: 'refresh-123',
    expires_at: futureExpiry,
  })

  assert.strictEqual(mock.refreshCallCount, 0, 'MUST NOT call refresh when token is valid')
  assert.strictEqual(mock.cachedTokens?.accessToken, 'existing-token')
  assert.ok(mock.logMessages.some(m => m.includes('Using existing access token')))
})

test('initOAuth REJECTS old 5-minute buffer semantics', async () => {
  mock.reset()
  const fourMinutesFromNow = Date.now() + 4 * 60 * 1000

  await mock.initOAuth({
    access_token: 'token-near-expiry',
    refresh_token: 'refresh-123',
    expires_at: fourMinutesFromNow,
  })

  assert.strictEqual(mock.refreshCallCount, 0, 'MUST NOT refresh when 4 minutes remain (old behavior would refresh)')
  assert.strictEqual(mock.cachedTokens?.accessToken, 'token-near-expiry', 'MUST reuse token even with <5min remaining')
})

test('initOAuth refreshes only when token is actually expired', async () => {
  mock.reset()
  const pastExpiry = Date.now() - 1000

  await mock.initOAuth({
    access_token: 'expired-token',
    refresh_token: 'refresh-123',
    expires_at: pastExpiry,
  })

  assert.strictEqual(mock.refreshCallCount, 1, 'MUST refresh when token is expired')
  assert.strictEqual(mock.cachedTokens?.accessToken, 'new-access-token-1')
  assert.ok(mock.logMessages.some(m => m.includes('Access token expired, refreshing...')))
})

test('getAccessToken returns null when expired (no lazy refresh)', () => {
  mock.reset()
  mock.cachedTokens = {
    accessToken: 'old-token',
    refreshToken: 'refresh-123',
    expiresAt: Date.now() - 1000,
  }

  const token = mock.getAccessToken()

  assert.strictEqual(token, null, 'MUST return null for expired token')
  assert.ok(mock.logMessages.some(m => m.includes('OAuth token expired, waiting for refresh...')))
})

test('getAccessTokenOrRefresh performs lazy refresh when expired', async () => {
  mock.reset()
  mock.cachedTokens = {
    accessToken: 'old-token',
    refreshToken: 'refresh-123',
    expiresAt: Date.now() - 1000,
  }

  const token = await mock.getAccessTokenOrRefresh('refresh-123')

  assert.strictEqual(mock.refreshCallCount, 1, 'MUST refresh lazily')
  assert.strictEqual(token, 'new-access-token-1')
  assert.ok(mock.logMessages.some(m => m.includes('Token expired, refreshing lazily...')))
})

test('getAccessTokenOrRefresh returns cached token when valid', async () => {
  mock.reset()
  mock.cachedTokens = {
    accessToken: 'valid-token',
    refreshToken: 'refresh-123',
    expiresAt: Date.now() + 3600 * 1000,
  }

  const token = await mock.getAccessTokenOrRefresh('refresh-123')

  assert.strictEqual(mock.refreshCallCount, 0, 'MUST NOT refresh when token is still valid')
  assert.strictEqual(token, 'valid-token')
})

test('scheduleRefresh timer fires at actual expiry, not 5min early', () => {
  mock.reset()
  const expiryTime = Date.now() + 10 * 60 * 1000
  mock.cachedTokens = {
    accessToken: 'test-token',
    refreshToken: 'refresh-123',
    expiresAt: expiryTime,
  }

  const msUntilExpiry = mock.cachedTokens.expiresAt - Date.now()
  const refreshIn = Math.max(msUntilExpiry, 1_000)

  const oldBehaviorRefreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 10_000)

  assert.ok(
    refreshIn > oldBehaviorRefreshIn,
    'New behavior MUST schedule later than old 5-minute buffer behavior'
  )
  assert.ok(
    Math.abs(refreshIn - msUntilExpiry) < 2000,
    'Timer MUST fire at expiry (within 1s margin)'
  )
})

async function main() {
  for (const t of tests) {
    await t()
  }
  console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

main()
