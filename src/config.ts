import { readFileSync, existsSync } from 'fs'
import { parse } from 'yaml'
import { resolve, dirname } from 'path'

export type TokenEntry = {
  name: string
  token: string
}

// Canonical profile structure - shared contract with Rust core
export type CanonicalProfile = {
  version: string
  identity: {
    device_id: string
    email: string
    account_uuid: string
    session_id: string
  }
  env: Record<string, string | boolean | number>
  prompt_env: {
    platform: string
    shell: string
    os_version: string
    working_dir: string
  }
  process: {
    constrained_memory: number
    rss_range: [number, number]
    heap_total_range: [number, number]
    heap_used_range: [number, number]
  }
  rewrite_policy?: {
    mode?: 'aggressive' | 'conservative' | 'passthrough'
    strip_billing_header?: boolean
    normalize_timestamps?: boolean
    preserve_fields?: string[]
  }
}

export type Config = {
  server: {
    port: number
    tls: {
      cert: string
      key: string
    }
  }
  upstream: {
    url: string
  }
  auth: {
    tokens: TokenEntry[]
  }
  oauth: {
    access_token?: string
    refresh_token: string
    expires_at?: number
  }
  // Optional: path to external canonical profile (takes precedence over inline config)
  canonical_profile_path?: string
  identity: {
    device_id: string
    email: string
    account_uuid: string
    session_id: string
  }
  env: Record<string, string | boolean | number>
  // System prompt environment masking - must be consistent with env above
  prompt_env: {
    platform: string        // "darwin" — must match env.platform
    shell: string           // "zsh"
    os_version: string      // "Darwin 24.4.0" — uname -sr output
    working_dir: string     // "/Users/jack/projects" — canonical home path prefix
  }
  process: {
    constrained_memory: number
    rss_range: [number, number]
    heap_total_range: [number, number]
    heap_used_range: [number, number]
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    audit: boolean
  }
  // Loaded canonical profile (if canonical_profile_path is set)
  _canonical_profile?: CanonicalProfile
}

export function loadConfig(configPath?: string): Config {
  const filePath = configPath || resolve(process.cwd(), 'config.yaml')
  const raw = readFileSync(filePath, 'utf-8')
  const config = parse(raw) as Config

  if (config.canonical_profile_path) {
    const profilePath = resolve(dirname(filePath), config.canonical_profile_path)
    if (!existsSync(profilePath)) {
      throw new Error(`config: canonical_profile_path points to non-existent file: ${profilePath}`)
    }
    
    const profileRaw = readFileSync(profilePath, 'utf-8')
    const profile = JSON.parse(profileRaw) as CanonicalProfile
    
    if (!profile.version || profile.version !== '1.0') {
      throw new Error(`config: canonical profile must have version "1.0", got: ${profile.version}`)
    }
    
    if (!profile.env || typeof profile.env !== 'object') {
      throw new Error('config: canonical profile must have env object')
    }
    
    const envKeys = Object.keys(profile.env)
    if (envKeys.length < 40) {
      throw new Error(`config: canonical profile env must have 40+ keys, got: ${envKeys.length}`)
    }
    
    config._canonical_profile = profile
    config.identity = profile.identity
    config.env = profile.env
    config.prompt_env = profile.prompt_env
    config.process = profile.process
  }

  if (!config.identity?.device_id || config.identity.device_id.length !== 64 || /^0+$/.test(config.identity.device_id)) {
    throw new Error('config: identity.device_id must be set to a real 64-char hex value. Run: npm run generate-identity')
  }
  if (!config.auth?.tokens?.length) {
    throw new Error('config: auth.tokens must have at least one entry')
  }
  if (!config.oauth?.refresh_token) {
    throw new Error('config: oauth.refresh_token is required. Do a browser OAuth login on the admin machine, then copy the refresh token from ~/.claude/.credentials.json')
  }

  return config
}
