export const PROXY_ENV_KEYS = [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'ALL_PROXY',
  'all_proxy',
] as const

export interface ProxyEnvironment {
  proxyUrl?: string
  proxyEnv: Record<string, string>
}

export function resolveProxyEnvironment(sourceEnv: NodeJS.ProcessEnv = process.env): ProxyEnvironment {
  const proxyEnv: Record<string, string> = {}

  for (const key of PROXY_ENV_KEYS) {
    const value = sourceEnv[key]
    if (value) {
      proxyEnv[key] = value
    }
  }

  return {
    proxyUrl:
      sourceEnv.HTTPS_PROXY ||
      sourceEnv.https_proxy ||
      sourceEnv.HTTP_PROXY ||
      sourceEnv.http_proxy ||
      sourceEnv.ALL_PROXY ||
      sourceEnv.all_proxy,
    proxyEnv,
  }
}
