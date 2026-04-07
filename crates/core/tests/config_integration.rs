#![recursion_limit = "256"]

use ccgw_core::Config;
use std::fs;
use std::path::Path;
use tempfile::TempDir;

#[test]
fn test_parse_config_example_yaml() {
    let paths = [
        "config.example.yaml",
        "../../config.example.yaml",
        "../../../config.example.yaml",
    ];

    let config = paths
        .iter()
        .find_map(|p| {
            let path = Path::new(p);
            if path.exists() {
                Some(Config::load(path))
            } else {
                None
            }
        })
        .expect("config.example.yaml not found in any of the expected locations");

    assert!(
        config.is_ok(),
        "Failed to parse config.example.yaml: {:?}",
        config.err()
    );

    let c = config.unwrap();
    assert!(
        !c.identity.device_id.is_empty(),
        "device_id should not be empty"
    );
    assert_eq!(c.server.port, 8443, "port should be 8443");
    assert_eq!(
        c.upstream.url, "https://api.anthropic.com",
        "upstream URL mismatch"
    );
    assert!(!c.auth.tokens.is_empty(), "should have at least one token");

    println!("✓ Config parsed successfully");
    println!("  - Device ID: {}", c.identity.device_id);
    println!("  - Port: {}", c.server.port);
    println!("  - Tokens: {}", c.auth.tokens.len());
}

const LEGACY_CONFIG: &str = r#"
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
  account_uuid: "test-account-uuid"
  session_id: "test-session-id"
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
  is_claubbit: false
  is_claude_code_remote: false
  is_local_agent_mode: false
  is_conductor: false
  is_github_action: false
  is_claude_code_action: false
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
"#;

fn create_canonical_profile_json() -> String {
    serde_json::json!({
        "version": "1.0",
        "identity": {
            "device_id": "c1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
            "email": "canonical@example.com",
            "account_uuid": "canonical-account-uuid",
            "session_id": "canonical-session-id"
        },
        "env": {
            "platform": "linux",
            "platform_raw": "linux",
            "arch": "x64",
            "node_version": "v22.0.0",
            "terminal": "alacritty",
            "package_managers": "npm,yarn,pnpm",
            "runtimes": "node,bun",
            "is_running_with_bun": false,
            "is_ci": false,
            "is_claubbit": false,
            "is_claude_code_remote": false,
            "is_local_agent_mode": false,
            "is_conductor": false,
            "is_github_action": false,
            "is_claude_code_action": false,
            "is_claude_ai_auth": true,
            "version": "2.2.0",
            "version_base": "2.2",
            "build_time": "2026-04-01T00:00:00Z",
            "deployment_environment": "production",
            "vcs": "git",
            "shell": "bash",
            "shell_version": "bash 5.2",
            "locale": "en_GB.UTF-8",
            "timezone": "Europe/London",
            "editor": "nvim",
            "cpu_cores": 16,
            "total_memory": 68719476736_u64,
            "hostname": "prod-server",
            "username": "deploy",
            "home_dir": "/home/deploy",
            "os_release": "22.04",
            "kernel_version": "Linux 6.5.0",
            "docker_available": true,
            "git_version": "2.43.0",
            "python_version": "3.11.8",
            "screen_resolution": "2560x1440",
            "color_depth": 24,
            "network_interfaces": "eth0,lo",
            "ipv4_address": "10.0.1.50",
            "ipv6_address": "fe80::2",
            "mac_address": "00:1a:2b:3c:4d:5e",
            "uptime": 1234567,
            "boot_time": "2026-03-01T08:00:00Z",
            "extra_field_1": "value1",
            "extra_field_2": "value2",
            "extra_field_3": "value3",
            "extra_field_4": "value4",
            "extra_field_5": "value5"
        },
        "prompt_env": {
            "platform": "linux",
            "shell": "bash",
            "os_version": "Linux 6.5.0",
            "working_dir": "/home/deploy/work"
        },
        "process": {
            "constrained_memory": 68719476736_u64,
            "rss_range": [500000000_u64, 800000000_u64],
            "heap_total_range": [80000000_u64, 120000000_u64],
            "heap_used_range": [150000000_u64, 250000000_u64]
        },
        "rewrite_policy": {
            "mode": "aggressive",
            "strip_billing_header": true,
            "normalize_timestamps": false,
            "preserve_fields": []
        }
    })
    .to_string()
}

#[test]
fn test_legacy_config_loads_without_canonical_profile() {
    let tmp = TempDir::new().unwrap();
    let config_path = tmp.path().join("legacy.yaml");
    fs::write(&config_path, LEGACY_CONFIG).unwrap();

    let config = Config::load(&config_path).expect("Failed to load legacy config");

    assert_eq!(
        config.identity.device_id,
        "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"
    );
    assert_eq!(config.identity.email, "test@example.com");
    assert_eq!(config.env.platform, "darwin");
    assert!(config.canonical_profile_path.is_none());
    assert!(config.canonical_profile.is_none());
}

#[test]
fn test_canonical_profile_loads_and_overrides() {
    let tmp = TempDir::new().unwrap();

    let profile_path = tmp.path().join("profile.json");
    fs::write(&profile_path, create_canonical_profile_json()).unwrap();

    let config_with_profile = format!("{}\ncanonical_profile_path: profile.json\n", LEGACY_CONFIG);
    let config_path = tmp.path().join("with-profile.yaml");
    fs::write(&config_path, config_with_profile).unwrap();

    let config = Config::load(&config_path).expect("Failed to load config with canonical profile");

    assert_eq!(
        config.identity.device_id,
        "c1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"
    );
    assert_eq!(config.identity.email, "canonical@example.com");
    assert_eq!(config.env.platform, "linux");
    assert_eq!(config.env.arch, "x64");
    assert_eq!(config.prompt_env.platform, "linux");
    assert_eq!(config.prompt_env.shell, "bash");
    assert_eq!(config.process.constrained_memory, 68719476736);

    assert!(config.canonical_profile.is_some());
    let profile = config.canonical_profile.unwrap();
    assert_eq!(profile.version, "1.0");
    assert!(
        profile.env.len() >= 40,
        "Expected at least 40 env keys, got {}",
        profile.env.len()
    );
    let rewrite_policy = profile
        .rewrite_policy
        .expect("canonical profile should preserve rewrite_policy metadata");
    assert_eq!(rewrite_policy.mode.as_deref(), Some("aggressive"));
    assert_eq!(rewrite_policy.strip_billing_header, Some(true));
    assert_eq!(rewrite_policy.normalize_timestamps, Some(false));
    assert_eq!(rewrite_policy.preserve_fields, Some(Vec::new()));
}

#[test]
fn test_canonical_profile_40_plus_env_keys_validation() {
    let tmp = TempDir::new().unwrap();

    let profile_path = tmp.path().join("large-profile.json");
    fs::write(&profile_path, create_canonical_profile_json()).unwrap();

    let config_with_profile = format!(
        "{}\ncanonical_profile_path: large-profile.json\n",
        LEGACY_CONFIG
    );
    let config_path = tmp.path().join("large.yaml");
    fs::write(&config_path, config_with_profile).unwrap();

    let config = Config::load(&config_path).expect("Failed to load config with large profile");
    let profile = config.canonical_profile.expect("Profile should be loaded");

    assert!(
        profile.env.len() >= 40,
        "Expected 40+ env keys, got {}",
        profile.env.len()
    );
}

#[test]
fn test_canonical_profile_path_resolves_relative_to_config_file() {
    let tmp = TempDir::new().unwrap();
    let config_dir = tmp.path().join("configs");
    fs::create_dir_all(&config_dir).unwrap();

    let profile_path = tmp.path().join("relative-profile.json");
    fs::write(&profile_path, create_canonical_profile_json()).unwrap();

    let config_with_relative_profile = format!(
        "{}\ncanonical_profile_path: ../relative-profile.json\n",
        LEGACY_CONFIG
    );
    let config_path = config_dir.join("config.yaml");
    fs::write(&config_path, config_with_relative_profile).unwrap();

    let config = Config::load(&config_path).expect("Failed to resolve relative profile path");

    assert_eq!(
        config.identity.device_id,
        "c1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"
    );
    assert_eq!(config.identity.email, "canonical@example.com");
}

#[test]
fn test_canonical_profile_less_than_40_keys_fails() {
    let tmp = TempDir::new().unwrap();

    let small_profile = serde_json::json!({
        "version": "1.0",
        "identity": {
            "device_id": "d1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
            "email": "test@example.com",
            "account_uuid": "test-account-uuid",
            "session_id": "test-session-id"
        },
        "env": {
            "platform": "linux",
            "arch": "x64"
        },
        "prompt_env": {
            "platform": "linux",
            "shell": "bash",
            "os_version": "Linux 6.5.0",
            "working_dir": "/home/test"
        },
        "process": {
            "constrained_memory": 17179869184_u64,
            "rss_range": [300000000_u64, 500000000_u64],
            "heap_total_range": [100000000_u64, 200000000_u64],
            "heap_used_range": [50000000_u64, 150000000_u64]
        }
    })
    .to_string();

    let profile_path = tmp.path().join("small-profile.json");
    fs::write(&profile_path, small_profile).unwrap();

    let config_with_profile = format!(
        "{}\ncanonical_profile_path: small-profile.json\n",
        LEGACY_CONFIG
    );
    let config_path = tmp.path().join("small.yaml");
    fs::write(&config_path, config_with_profile).unwrap();

    let result = Config::load(&config_path);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("40+ keys"),
        "Error should mention 40+ keys requirement: {}",
        err_msg
    );
}

#[test]
fn test_canonical_profile_path_not_found() {
    let tmp = TempDir::new().unwrap();

    let config_with_bad_path = format!(
        "{}\ncanonical_profile_path: nonexistent.json\n",
        LEGACY_CONFIG
    );
    let config_path = tmp.path().join("bad-path.yaml");
    fs::write(&config_path, config_with_bad_path).unwrap();

    let result = Config::load(&config_path);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("non-existent"),
        "Error should mention non-existent file: {}",
        err_msg
    );
}

#[test]
fn test_canonical_profile_wrong_version() {
    let tmp = TempDir::new().unwrap();

    let wrong_version_profile = serde_json::json!({
        "version": "2.0",
        "identity": {
            "device_id": "d1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
            "email": "test@example.com",
            "account_uuid": "test-account-uuid",
            "session_id": "test-session-id"
        },
        "env": create_large_env_object(),
        "prompt_env": {
            "platform": "linux",
            "shell": "bash",
            "os_version": "Linux 6.5.0",
            "working_dir": "/home/test"
        },
        "process": {
            "constrained_memory": 17179869184_u64,
            "rss_range": [300000000_u64, 500000000_u64],
            "heap_total_range": [100000000_u64, 200000000_u64],
            "heap_used_range": [50000000_u64, 150000000_u64]
        }
    })
    .to_string();

    let profile_path = tmp.path().join("wrong-version.json");
    fs::write(&profile_path, wrong_version_profile).unwrap();

    let config_with_profile = format!(
        "{}\ncanonical_profile_path: wrong-version.json\n",
        LEGACY_CONFIG
    );
    let config_path = tmp.path().join("wrong-ver.yaml");
    fs::write(&config_path, config_with_profile).unwrap();

    let result = Config::load(&config_path);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("1.0"),
        "Error should mention required version 1.0: {}",
        err_msg
    );
}

#[test]
fn test_canonical_profile_get_env_value() {
    let tmp = TempDir::new().unwrap();

    let profile_path = tmp.path().join("profile.json");
    fs::write(&profile_path, create_canonical_profile_json()).unwrap();

    let config_with_profile = format!("{}\ncanonical_profile_path: profile.json\n", LEGACY_CONFIG);
    let config_path = tmp.path().join("with-profile.yaml");
    fs::write(&config_path, config_with_profile).unwrap();

    let config = Config::load(&config_path).expect("Failed to load config");

    let platform = config.get_env_value("platform");
    assert!(platform.is_some());
    assert_eq!(platform.unwrap().as_str(), Some("linux"));

    let cpu_cores = config.get_env_value("cpu_cores");
    assert!(cpu_cores.is_some());
    assert_eq!(cpu_cores.unwrap().as_u64(), Some(16));

    let nonexistent = config.get_env_value("nonexistent_key");
    assert!(nonexistent.is_none());
}

fn create_large_env_object() -> serde_json::Value {
    let mut env = serde_json::Map::new();
    for i in 0..50 {
        env.insert(
            format!("key_{}", i),
            serde_json::Value::String(format!("value_{}", i)),
        );
    }
    serde_json::Value::Object(env)
}
