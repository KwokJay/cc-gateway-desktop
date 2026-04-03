use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rand::Rng;
use serde_json::{json, Value};

use crate::config::{Config, EnvConfig, ProcessConfig};

/// Build canonical env from loaded Config.
/// Returns the full canonical profile env map (40+ keys) if available,
/// otherwise falls back to legacy fixed 21-field construction.
pub fn build_canonical_env_from_config(config: &Config) -> Value {
    if let Some(ref profile) = config.canonical_profile {
        return Value::Object(
            profile
                .env
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect(),
        );
    }

    build_canonical_env_from_env_config(&config.env)
}

/// Legacy: build canonical env from EnvConfig (fixed 21 fields).
/// Retained for backward compatibility and testing.
pub fn build_canonical_env_from_env_config(env: &EnvConfig) -> Value {
    json!({
        "platform": env.platform,
        "platform_raw": env.platform_raw,
        "arch": env.arch,
        "node_version": env.node_version,
        "terminal": env.terminal,
        "package_managers": env.package_managers,
        "runtimes": env.runtimes,
        "is_running_with_bun": env.is_running_with_bun,
        "is_ci": false,
        "is_claubbit": false,
        "is_claude_code_remote": false,
        "is_local_agent_mode": false,
        "is_conductor": false,
        "is_github_action": false,
        "is_claude_code_action": false,
        "is_claude_ai_auth": env.is_claude_ai_auth,
        "version": env.version,
        "version_base": env.version_base,
        "build_time": env.build_time,
        "deployment_environment": env.deployment_environment,
        "vcs": env.vcs,
    })
}

/// Rewrite event_data.env using the canonical env map from Config.
pub fn rewrite_event_env(event_data: &mut Value, config: &Config) {
    let Some(object) = event_data.as_object_mut() else {
        return;
    };

    if object.contains_key("env") {
        object.insert("env".to_string(), build_canonical_env_from_config(config));
    }
}

pub fn build_canonical_process(original: &Value, process: &ProcessConfig) -> Value {
    match original {
        Value::String(encoded) => {
            rewrite_base64_process(encoded, process).unwrap_or_else(|| original.clone())
        }
        Value::Object(_) => rewrite_process_fields(original, process),
        _ => original.clone(),
    }
}

pub fn rewrite_event_process(event_data: &mut Value, process: &ProcessConfig) {
    let Some(object) = event_data.as_object_mut() else {
        return;
    };

    let Some(original_process) = object.get("process").cloned() else {
        return;
    };

    object.insert(
        "process".to_string(),
        build_canonical_process(&original_process, process),
    );
}

fn rewrite_base64_process(encoded: &str, process: &ProcessConfig) -> Option<Value> {
    let decoded = STANDARD.decode(encoded).ok()?;
    let parsed = serde_json::from_slice::<Value>(&decoded).ok()?;
    let rewritten = rewrite_process_fields(&parsed, process);
    let encoded = STANDARD.encode(serde_json::to_vec(&rewritten).ok()?);
    Some(Value::String(encoded))
}

fn rewrite_process_fields(original: &Value, process: &ProcessConfig) -> Value {
    let mut rewritten = original.clone();
    let Some(object) = rewritten.as_object_mut() else {
        return original.clone();
    };

    object.insert(
        "constrainedMemory".to_string(),
        Value::from(process.constrained_memory),
    );
    object.insert(
        "rss".to_string(),
        Value::from(random_in_range(process.rss_range)),
    );
    object.insert(
        "heapTotal".to_string(),
        Value::from(random_in_range(process.heap_total_range)),
    );
    object.insert(
        "heapUsed".to_string(),
        Value::from(random_in_range(process.heap_used_range)),
    );

    rewritten
}

fn random_in_range(range: [u64; 2]) -> u64 {
    let [min, max] = range;
    if max <= min {
        min
    } else {
        rand::thread_rng().gen_range(min..max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{
        AuthConfig, Config, EnvConfig, IdentityConfig, LoggingConfig, OAuthConfig, PromptEnvConfig,
        ServerConfig, TokenEntry, UpstreamConfig,
    };
    use std::collections::HashMap;

    fn env_config() -> EnvConfig {
        EnvConfig {
            platform: "darwin".to_string(),
            platform_raw: "darwin".to_string(),
            arch: "arm64".to_string(),
            node_version: "v24.3.0".to_string(),
            terminal: "iTerm2.app".to_string(),
            package_managers: "npm,pnpm".to_string(),
            runtimes: "node".to_string(),
            is_running_with_bun: false,
            is_ci: true,
            is_claubbit: true,
            is_claude_code_remote: true,
            is_local_agent_mode: true,
            is_conductor: true,
            is_github_action: true,
            is_claude_code_action: true,
            is_claude_ai_auth: true,
            version: "2.1.81".to_string(),
            version_base: "2.1.81".to_string(),
            build_time: "2026-03-20T21:26:18Z".to_string(),
            deployment_environment: "unknown-darwin".to_string(),
            vcs: "git".to_string(),
        }
    }

    fn process_config() -> ProcessConfig {
        ProcessConfig {
            constrained_memory: 34_359_738_368,
            rss_range: [300_000_000, 500_000_000],
            heap_total_range: [40_000_000, 80_000_000],
            heap_used_range: [100_000_000, 200_000_000],
        }
    }

    fn legacy_config() -> Config {
        Config {
            server: ServerConfig {
                port: 8443,
                tls: None,
            },
            upstream: UpstreamConfig {
                url: "https://api.anthropic.com".to_string(),
            },
            oauth: OAuthConfig {
                access_token: None,
                refresh_token: "test_refresh".to_string(),
                expires_at: None,
            },
            auth: AuthConfig {
                tokens: vec![TokenEntry {
                    name: "test".to_string(),
                    token: "test123".to_string(),
                }],
            },
            canonical_profile_path: None,
            identity: IdentityConfig {
                device_id: "legacy_device".to_string(),
                email: "legacy@example.com".to_string(),
                account_uuid: "legacy-uuid".to_string(),
                session_id: "legacy-session".to_string(),
            },
            env: env_config(),
            prompt_env: PromptEnvConfig {
                platform: "darwin".to_string(),
                shell: "zsh".to_string(),
                os_version: "Darwin 24.4.0".to_string(),
                working_dir: "/Users/test".to_string(),
            },
            process: process_config(),
            logging: LoggingConfig {
                level: "info".to_string(),
                audit: false,
            },
            canonical_profile: None,
        }
    }

    fn canonical_config() -> Config {
        let mut canonical_env_map = HashMap::new();
        canonical_env_map.insert("platform".to_string(), json!("linux"));
        canonical_env_map.insert("platform_raw".to_string(), json!("linux"));
        canonical_env_map.insert("arch".to_string(), json!("x64"));
        canonical_env_map.insert("node_version".to_string(), json!("v22.0.0"));
        canonical_env_map.insert("terminal".to_string(), json!("alacritty"));
        canonical_env_map.insert("package_managers".to_string(), json!("npm,yarn"));
        canonical_env_map.insert("runtimes".to_string(), json!("node,bun"));
        canonical_env_map.insert("is_running_with_bun".to_string(), json!(false));
        canonical_env_map.insert("is_ci".to_string(), json!(false));
        canonical_env_map.insert("is_claubbit".to_string(), json!(false));
        canonical_env_map.insert("is_claude_code_remote".to_string(), json!(false));
        canonical_env_map.insert("is_local_agent_mode".to_string(), json!(false));
        canonical_env_map.insert("is_conductor".to_string(), json!(false));
        canonical_env_map.insert("is_github_action".to_string(), json!(false));
        canonical_env_map.insert("is_claude_code_action".to_string(), json!(false));
        canonical_env_map.insert("is_claude_ai_auth".to_string(), json!(true));
        canonical_env_map.insert("version".to_string(), json!("2.2.0"));
        canonical_env_map.insert("version_base".to_string(), json!("2.2"));
        canonical_env_map.insert("build_time".to_string(), json!("2026-04-01T00:00:00Z"));
        canonical_env_map.insert("deployment_environment".to_string(), json!("production"));
        canonical_env_map.insert("vcs".to_string(), json!("git"));
        canonical_env_map.insert("shell".to_string(), json!("bash"));
        canonical_env_map.insert("shell_version".to_string(), json!("bash 5.2"));
        canonical_env_map.insert("locale".to_string(), json!("en_GB.UTF-8"));
        canonical_env_map.insert("timezone".to_string(), json!("Europe/London"));
        canonical_env_map.insert("editor".to_string(), json!("nvim"));
        canonical_env_map.insert("cpu_cores".to_string(), json!(16));
        canonical_env_map.insert("total_memory".to_string(), json!(68719476736_u64));
        canonical_env_map.insert("hostname".to_string(), json!("prod-server"));
        canonical_env_map.insert("username".to_string(), json!("deploy"));
        canonical_env_map.insert("home_dir".to_string(), json!("/home/deploy"));
        canonical_env_map.insert("os_release".to_string(), json!("22.04"));
        canonical_env_map.insert("kernel_version".to_string(), json!("Linux 6.5.0"));
        canonical_env_map.insert("docker_available".to_string(), json!(true));
        canonical_env_map.insert("git_version".to_string(), json!("2.43.0"));
        canonical_env_map.insert("python_version".to_string(), json!("3.11.8"));
        canonical_env_map.insert("screen_resolution".to_string(), json!("2560x1440"));
        canonical_env_map.insert("color_depth".to_string(), json!(24));
        canonical_env_map.insert("network_interfaces".to_string(), json!("eth0,lo"));
        canonical_env_map.insert("ipv4_address".to_string(), json!("10.0.1.50"));
        canonical_env_map.insert("ipv6_address".to_string(), json!("fe80::2"));
        canonical_env_map.insert("mac_address".to_string(), json!("00:1a:2b:3c:4d:5e"));
        canonical_env_map.insert("uptime".to_string(), json!(1234567));
        canonical_env_map.insert("boot_time".to_string(), json!("2026-03-01T08:00:00Z"));

        let mut config = legacy_config();
        config.canonical_profile = Some(crate::config::CanonicalProfile {
            version: "1.0".to_string(),
            identity: IdentityConfig {
                device_id: "canonical_device".to_string(),
                email: "canonical@example.com".to_string(),
                account_uuid: "canonical-uuid".to_string(),
                session_id: "canonical-session".to_string(),
            },
            env: canonical_env_map,
            prompt_env: PromptEnvConfig {
                platform: "linux".to_string(),
                shell: "bash".to_string(),
                os_version: "Linux 6.5.0".to_string(),
                working_dir: "/home/deploy/work".to_string(),
            },
            process: ProcessConfig {
                constrained_memory: 68719476736,
                rss_range: [500_000_000, 800_000_000],
                heap_total_range: [80_000_000, 120_000_000],
                heap_used_range: [150_000_000, 250_000_000],
            },
            rewrite_policy: None,
        });
        config
    }

    #[test]
    fn builds_legacy_env_from_env_config_with_21_fields() {
        let env = env_config();
        let canonical = build_canonical_env_from_env_config(&env);
        let object = canonical.as_object().unwrap();

        assert_eq!(object.len(), 21);
        assert_eq!(canonical["platform"], env.platform);
        assert_eq!(canonical["platform_raw"], env.platform_raw);
        assert_eq!(canonical["arch"], env.arch);
        assert_eq!(canonical["node_version"], env.node_version);
        assert_eq!(canonical["terminal"], env.terminal);
        assert_eq!(canonical["package_managers"], env.package_managers);
        assert_eq!(canonical["runtimes"], env.runtimes);
        assert_eq!(canonical["is_running_with_bun"], env.is_running_with_bun);
        assert_eq!(canonical["is_ci"], false);
        assert_eq!(canonical["is_claubbit"], false);
        assert_eq!(canonical["is_claude_code_remote"], false);
        assert_eq!(canonical["is_local_agent_mode"], false);
        assert_eq!(canonical["is_conductor"], false);
        assert_eq!(canonical["is_github_action"], false);
        assert_eq!(canonical["is_claude_code_action"], false);
        assert_eq!(canonical["is_claude_ai_auth"], env.is_claude_ai_auth);
        assert_eq!(canonical["version"], env.version);
        assert_eq!(canonical["version_base"], env.version_base);
        assert_eq!(canonical["build_time"], env.build_time);
        assert_eq!(
            canonical["deployment_environment"],
            env.deployment_environment
        );
        assert_eq!(canonical["vcs"], env.vcs);
    }

    #[test]
    fn builds_canonical_env_from_config_without_profile_yields_21_fields() {
        let config = legacy_config();
        let canonical = build_canonical_env_from_config(&config);
        let object = canonical.as_object().unwrap();

        assert_eq!(
            object.len(),
            21,
            "Legacy inline config must yield exactly 21 fields"
        );
        assert_eq!(canonical["platform"], "darwin");
        assert_eq!(canonical["arch"], "arm64");
    }

    #[test]
    fn builds_canonical_env_from_config_with_profile_yields_40_plus_fields() {
        let config = canonical_config();
        let canonical = build_canonical_env_from_config(&config);
        let object = canonical.as_object().unwrap();

        assert!(
            object.len() >= 40,
            "Canonical profile must yield 40+ env keys, got: {}",
            object.len()
        );
        assert_eq!(canonical["platform"], "linux");
        assert_eq!(canonical["arch"], "x64");
        assert_eq!(canonical["cpu_cores"], 16);
        assert_eq!(canonical["hostname"], "prod-server");
    }

    #[test]
    fn rewrites_event_env_with_legacy_config() {
        let config = legacy_config();
        let mut event_data = json!({
            "env": {
                "platform": "linux",
                "arch": "x64",
                "is_ci": true
            }
        });

        rewrite_event_env(&mut event_data, &config);

        let env_obj = event_data["env"].as_object().unwrap();
        assert_eq!(
            env_obj.len(),
            21,
            "Legacy config event rewrite must yield 21 fields"
        );
        assert_eq!(event_data["env"]["platform"], "darwin");
        assert_eq!(event_data["env"]["arch"], "arm64");
        assert_eq!(event_data["env"]["is_ci"], false);
    }

    #[test]
    fn rewrites_event_env_with_canonical_profile() {
        let config = canonical_config();
        let mut event_data = json!({
            "env": {
                "platform": "windows",
                "arch": "x86",
                "is_ci": true
            }
        });

        rewrite_event_env(&mut event_data, &config);

        let env_obj = event_data["env"].as_object().unwrap();
        assert!(
            env_obj.len() >= 40,
            "Canonical profile event rewrite must yield 40+ env keys, got: {}",
            env_obj.len()
        );
        assert_eq!(event_data["env"]["platform"], "linux");
        assert_eq!(event_data["env"]["arch"], "x64");
        assert_eq!(event_data["env"]["cpu_cores"], 16);
        assert_eq!(event_data["env"]["hostname"], "prod-server");
    }

    #[test]
    fn builds_canonical_process_with_randomized_metrics() {
        let process = process_config();
        let original = json!({
            "uptime": 100,
            "rss": 999_999_999u64,
            "heapTotal": 999_999_999u64,
            "heapUsed": 999_999_999u64,
            "constrainedMemory": 68_719_476_736u64,
            "cpuUsage": { "user": 1000, "system": 500 }
        });

        let rewritten = build_canonical_process(&original, &process);

        assert_eq!(rewritten["uptime"], 100);
        assert_eq!(rewritten["cpuUsage"]["user"], 1000);
        assert_eq!(rewritten["constrainedMemory"], process.constrained_memory);

        let rss = rewritten["rss"].as_u64().unwrap();
        let heap_total = rewritten["heapTotal"].as_u64().unwrap();
        let heap_used = rewritten["heapUsed"].as_u64().unwrap();

        assert!((process.rss_range[0]..process.rss_range[1]).contains(&rss));
        assert!((process.heap_total_range[0]..process.heap_total_range[1]).contains(&heap_total));
        assert!((process.heap_used_range[0]..process.heap_used_range[1]).contains(&heap_used));
    }

    #[test]
    fn rewrites_base64_encoded_process_payloads() {
        let process = process_config();
        let encoded = STANDARD.encode(
            serde_json::to_vec(&json!({
                "uptime": 100,
                "rss": 1,
                "heapTotal": 1,
                "heapUsed": 1,
                "constrainedMemory": 1
            }))
            .unwrap(),
        );
        let mut event_data = json!({ "process": encoded });

        rewrite_event_process(&mut event_data, &process);

        let decoded = STANDARD
            .decode(event_data["process"].as_str().unwrap())
            .unwrap();
        let rewritten: Value = serde_json::from_slice(&decoded).unwrap();

        assert_eq!(rewritten["uptime"], 100);
        assert_eq!(rewritten["constrainedMemory"], process.constrained_memory);
        assert!((process.rss_range[0]..process.rss_range[1])
            .contains(&rewritten["rss"].as_u64().unwrap()));
    }
}
