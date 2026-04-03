import { loadConfig } from '../src/config.js'
import { strict as assert } from 'assert'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TEST_DIR = './test-config-temp'

function setup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true })
  }
  mkdirSync(TEST_DIR, { recursive: true })
}

function teardown() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true })
  }
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ ${name}`)
    console.error(err)
    failed++
  }
}

setup()

const legacyYaml = `
server:
  port: 8443
upstream:
  url: "https://api.anthropic.com"
oauth:
  refresh_token: "test_refresh"
auth:
  tokens:
    - name: "alice"
      token: "token123"
identity:
  device_id: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"
  email: "test@example.com"
env:
  platform: "darwin"
  platform_raw: "darwin"
  arch: "arm64"
  node_version: "v20.11.0"
  terminal: "zsh"
  package_managers: "npm,pnpm"
  runtimes: "node"
  is_running_with_bun: false
  is_ci: false
  is_claude_ai_auth: true
  version: "2.1.81"
  version_base: "2.1"
  build_time: "2024-01-01T00:00:00Z"
  deployment_environment: "development"
  vcs: "git"
prompt_env:
  platform: "darwin"
  shell: "zsh"
  os_version: "Darwin 24.4.0"
  working_dir: "/Users/jack/projects"
process:
  constrained_memory: 17179869184
  rss_range: [300000000, 500000000]
  heap_total_range: [100000000, 200000000]
  heap_used_range: [50000000, 150000000]
logging:
  level: "info"
  audit: true
`

const canonicalProfile = {
  version: '1.0',
  identity: {
    device_id: 'canonical0000000000000000000000000000000000000000000000000000001',
    email: 'canonical@example.com',
  },
  env: {
    platform: 'linux',
    platform_raw: 'linux',
    arch: 'x64',
    node_version: 'v22.0.0',
    terminal: 'alacritty',
    package_managers: 'npm,yarn,pnpm',
    runtimes: 'node,bun',
    is_running_with_bun: false,
    is_ci: false,
    is_claubbit: false,
    is_claude_code_remote: false,
    is_local_agent_mode: false,
    is_conductor: false,
    is_github_action: false,
    is_claude_code_action: false,
    is_claude_ai_auth: true,
    version: '2.2.0',
    version_base: '2.2',
    build_time: '2026-04-01T00:00:00Z',
    deployment_environment: 'production',
    vcs: 'git',
    shell: 'bash',
    shell_version: 'bash 5.2',
    locale: 'en_GB.UTF-8',
    timezone: 'Europe/London',
    editor: 'nvim',
    cpu_cores: 16,
    total_memory: 68719476736,
    hostname: 'prod-server',
    username: 'deploy',
    home_dir: '/home/deploy',
    os_release: '22.04',
    kernel_version: 'Linux 6.5.0',
    docker_available: true,
    git_version: '2.43.0',
    python_version: '3.11.8',
    screen_resolution: '2560x1440',
    color_depth: 24,
    network_interfaces: 'eth0,lo',
    ipv4_address: '10.0.1.50',
    ipv6_address: 'fe80::2',
    mac_address: '00:1a:2b:3c:4d:5e',
    uptime: 1234567,
    boot_time: '2026-03-01T08:00:00Z',
    extra_field_1: 'value1',
    extra_field_2: 'value2',
    extra_field_3: 'value3',
    extra_field_4: 'value4',
    extra_field_5: 'value5',
  },
  prompt_env: {
    platform: 'linux',
    shell: 'bash',
    os_version: 'Linux 6.5.0',
    working_dir: '/home/deploy/work',
  },
  process: {
    constrained_memory: 68719476736,
    rss_range: [500000000, 800000000],
    heap_total_range: [80000000, 120000000],
    heap_used_range: [150000000, 250000000],
  },
  rewrite_policy: {
    mode: 'aggressive',
    strip_billing_header: true,
    normalize_timestamps: false,
    preserve_fields: [],
  },
}

test('legacy YAML config loads without canonical profile', () => {
  const configPath = join(TEST_DIR, 'legacy.yaml')
  writeFileSync(configPath, legacyYaml)
  
  const config = loadConfig(configPath)
  
  assert.equal(config.identity.device_id, 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1')
  assert.equal(config.identity.email, 'test@example.com')
  assert.equal(config.env.platform, 'darwin')
  assert.equal(config.canonical_profile_path, undefined)
  assert.equal(config._canonical_profile, undefined)
})

test('canonical profile loads and overrides inline config', () => {
  const profilePath = join(TEST_DIR, 'profile.json')
  writeFileSync(profilePath, JSON.stringify(canonicalProfile, null, 2))
  
  const yamlWithProfile = legacyYaml + '\ncanonical_profile_path: profile.json\n'
  const configPath = join(TEST_DIR, 'with-profile.yaml')
  writeFileSync(configPath, yamlWithProfile)
  
  const config = loadConfig(configPath)
  
  assert.equal(config.identity.device_id, 'canonical0000000000000000000000000000000000000000000000000000001')
  assert.equal(config.identity.email, 'canonical@example.com')
  assert.equal(config.env.platform, 'linux')
  assert.equal(config.env.arch, 'x64')
  assert.equal(config.prompt_env.platform, 'linux')
  assert.equal(config.prompt_env.shell, 'bash')
  assert.equal(config.process.constrained_memory, 68719476736)
  assert(config._canonical_profile !== undefined)
  assert.equal(config._canonical_profile.version, '1.0')
})

test('canonical profile with 40+ env keys passes validation', () => {
  const profilePath = join(TEST_DIR, 'large-profile.json')
  writeFileSync(profilePath, JSON.stringify(canonicalProfile, null, 2))
  
  const yamlWithProfile = legacyYaml + '\ncanonical_profile_path: large-profile.json\n'
  const configPath = join(TEST_DIR, 'large.yaml')
  writeFileSync(configPath, yamlWithProfile)
  
  const config = loadConfig(configPath)
  
  const envKeys = Object.keys(config.env)
  assert(envKeys.length >= 40, `Expected 40+ env keys, got ${envKeys.length}`)
})

test('canonical profile with <40 env keys throws error', () => {
  const smallProfile = {
    ...canonicalProfile,
    env: {
      platform: 'linux',
      arch: 'x64',
    },
  }
  
  const profilePath = join(TEST_DIR, 'small-profile.json')
  writeFileSync(profilePath, JSON.stringify(smallProfile, null, 2))
  
  const yamlWithProfile = legacyYaml + '\ncanonical_profile_path: small-profile.json\n'
  const configPath = join(TEST_DIR, 'small.yaml')
  writeFileSync(configPath, yamlWithProfile)
  
  try {
    loadConfig(configPath)
    assert.fail('Should have thrown error for <40 env keys')
  } catch (err: any) {
    assert(err.message.includes('40+ keys'))
  }
})

test('canonical profile path not found throws error', () => {
  const yamlWithBadPath = legacyYaml + '\ncanonical_profile_path: nonexistent.json\n'
  const configPath = join(TEST_DIR, 'bad-path.yaml')
  writeFileSync(configPath, yamlWithBadPath)
  
  try {
    loadConfig(configPath)
    assert.fail('Should have thrown error for non-existent profile')
  } catch (err: any) {
    assert(err.message.includes('non-existent'))
  }
})

test('canonical profile with wrong version throws error', () => {
  const wrongVersionProfile = {
    ...canonicalProfile,
    version: '2.0',
  }
  
  const profilePath = join(TEST_DIR, 'wrong-version.json')
  writeFileSync(profilePath, JSON.stringify(wrongVersionProfile, null, 2))
  
  const yamlWithProfile = legacyYaml + '\ncanonical_profile_path: wrong-version.json\n'
  const configPath = join(TEST_DIR, 'wrong-ver.yaml')
  writeFileSync(configPath, yamlWithProfile)
  
  try {
    loadConfig(configPath)
    assert.fail('Should have thrown error for wrong version')
  } catch (err: any) {
    assert(err.message.includes('version "1.0"'))
  }
})

test('canonical profile path resolves relative to config file', () => {
  const subDir = join(TEST_DIR, 'subdir')
  mkdirSync(subDir, { recursive: true })
  
  const profilePath = join(TEST_DIR, 'relative-profile.json')
  writeFileSync(profilePath, JSON.stringify(canonicalProfile, null, 2))
  
  const yamlWithRelPath = legacyYaml + '\ncanonical_profile_path: ../relative-profile.json\n'
  const configPath = join(subDir, 'config.yaml')
  writeFileSync(configPath, yamlWithRelPath)
  
  const config = loadConfig(configPath)
  
  assert.equal(config.identity.device_id, 'canonical0000000000000000000000000000000000000000000000000000001')
})

teardown()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
