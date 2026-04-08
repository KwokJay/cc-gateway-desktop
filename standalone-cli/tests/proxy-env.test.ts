import { strict as assert } from 'assert'

const { PROXY_ENV_KEYS, resolveProxyEnvironment } = await import(
  new URL('../src/environment/proxy-env.ts', import.meta.url).href
)

assert.deepEqual(PROXY_ENV_KEYS, [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'ALL_PROXY',
  'all_proxy',
])

{
  const resolved = resolveProxyEnvironment({
    HTTPS_PROXY: 'http://upper-https.example.test:8443',
    https_proxy: 'http://lower-https.example.test:8443',
    HTTP_PROXY: 'http://upper-http.example.test:8080',
    http_proxy: 'http://lower-http.example.test:8080',
    ALL_PROXY: 'socks5://upper-all.example.test:1080',
    all_proxy: 'socks5://lower-all.example.test:1080',
  })

  assert.equal(
    resolved.proxyUrl,
    'http://upper-https.example.test:8443',
    'proxy selection must preserve the legacy HTTPS_PROXY -> https_proxy -> HTTP_PROXY -> http_proxy -> ALL_PROXY -> all_proxy order',
  )
  assert.deepEqual(resolved.proxyEnv, {
    HTTPS_PROXY: 'http://upper-https.example.test:8443',
    https_proxy: 'http://lower-https.example.test:8443',
    HTTP_PROXY: 'http://upper-http.example.test:8080',
    http_proxy: 'http://lower-http.example.test:8080',
    ALL_PROXY: 'socks5://upper-all.example.test:1080',
    all_proxy: 'socks5://lower-all.example.test:1080',
  })
}

{
  const resolved = resolveProxyEnvironment({
    http_proxy: 'http://lower-http.example.test:8080',
    FEATURE_FLAG: 'enabled',
  })

  assert.equal(resolved.proxyUrl, 'http://lower-http.example.test:8080')
  assert.deepEqual(resolved.proxyEnv, {
    http_proxy: 'http://lower-http.example.test:8080',
  })
  assert.equal(
    'HTTP_PROXY' in resolved.proxyEnv,
    false,
    'lowercase-only env must be preserved as-is rather than normalized into uppercase variants',
  )
}

{
  const resolved = resolveProxyEnvironment({
    all_proxy: 'socks5://lower-all.example.test:1080',
  })

  assert.equal(resolved.proxyUrl, 'socks5://lower-all.example.test:1080')
  assert.deepEqual(resolved.proxyEnv, {
    all_proxy: 'socks5://lower-all.example.test:1080',
  })
}

{
  const resolved = resolveProxyEnvironment({})

  assert.equal(resolved.proxyUrl, undefined)
  assert.deepEqual(resolved.proxyEnv, {})
}

console.log('proxy-env.test.ts: ok')
