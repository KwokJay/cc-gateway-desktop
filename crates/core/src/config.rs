use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to read config file: {0}")]
    Io(#[from] std::io::Error),
    #[error("Failed to parse YAML: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("Failed to parse JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Invalid configuration: {0}")]
    Validation(String),
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub server: ServerConfig,
    pub upstream: UpstreamConfig,
    pub oauth: OAuthConfig,
    pub auth: AuthConfig,
    pub canonical_profile_path: Option<String>,
    pub identity: IdentityConfig,
    pub env: EnvConfig,
    #[serde(rename = "prompt_env")]
    pub prompt_env: PromptEnvConfig,
    pub process: ProcessConfig,
    pub logging: LoggingConfig,
    #[serde(skip)]
    pub canonical_profile: Option<CanonicalProfile>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub port: u16,
    pub tls: Option<TlsConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TlsConfig {
    pub cert: String,
    pub key: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpstreamConfig {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct OAuthConfig {
    pub access_token: Option<String>,
    pub refresh_token: String,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuthConfig {
    pub tokens: Vec<TokenEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TokenEntry {
    pub name: String,
    pub token: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IdentityConfig {
    pub device_id: String,
    pub email: String,
    pub account_uuid: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct EnvConfig {
    pub platform: String,
    pub platform_raw: String,
    pub arch: String,
    pub node_version: String,
    pub terminal: String,
    pub package_managers: String,
    pub runtimes: String,
    pub is_running_with_bun: bool,
    pub is_ci: bool,
    #[serde(default)]
    pub is_claubbit: bool,
    #[serde(default)]
    pub is_claude_code_remote: bool,
    #[serde(default)]
    pub is_local_agent_mode: bool,
    #[serde(default)]
    pub is_conductor: bool,
    #[serde(default)]
    pub is_github_action: bool,
    #[serde(default)]
    pub is_claude_code_action: bool,
    pub is_claude_ai_auth: bool,
    pub version: String,
    pub version_base: String,
    pub build_time: String,
    pub deployment_environment: String,
    pub vcs: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct PromptEnvConfig {
    pub platform: String,
    pub shell: String,
    pub os_version: String,
    pub working_dir: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ProcessConfig {
    pub constrained_memory: u64,
    pub rss_range: [u64; 2],
    pub heap_total_range: [u64; 2],
    pub heap_used_range: [u64; 2],
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoggingConfig {
    pub level: String,
    pub audit: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CanonicalProfile {
    pub version: String,
    pub identity: IdentityConfig,
    pub env: HashMap<String, JsonValue>,
    pub prompt_env: PromptEnvConfig,
    pub process: ProcessConfig,
    pub rewrite_policy: Option<RewritePolicy>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RewritePolicy {
    pub mode: Option<String>,
    pub strip_billing_header: Option<bool>,
    pub normalize_timestamps: Option<bool>,
    pub preserve_fields: Option<Vec<String>>,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        let content = std::fs::read_to_string(path)?;
        let mut config: Config = serde_yaml::from_str(&content)?;

        if let Some(profile_path_str) = &config.canonical_profile_path {
            let config_dir = path.parent().unwrap_or_else(|| Path::new("."));
            let profile_path = config_dir.join(profile_path_str);

            if !profile_path.exists() {
                return Err(ConfigError::Validation(format!(
                    "canonical_profile_path points to non-existent file: {}",
                    profile_path.display()
                )));
            }

            let profile_content = std::fs::read_to_string(&profile_path)?;
            let profile: CanonicalProfile = serde_json::from_str(&profile_content)?;

            if profile.version != "1.0" {
                return Err(ConfigError::Validation(format!(
                    "canonical profile must have version \"1.0\", got: {}",
                    profile.version
                )));
            }

            let env_count = profile.env.len();
            if env_count < 40 {
                return Err(ConfigError::Validation(format!(
                    "canonical profile env must have 40+ keys, got: {}",
                    env_count
                )));
            }

            let canonical_env: EnvConfig =
                serde_json::from_value(serde_json::to_value(&profile.env)?).map_err(|error| {
                    ConfigError::Validation(format!(
                        "config: canonical profile env is invalid: {error}"
                    ))
                })?;

            config.identity = profile.identity.clone();
            config.env = canonical_env;
            config.prompt_env = profile.prompt_env.clone();
            config.process = profile.process.clone();
            config.canonical_profile = Some(profile);
        }

        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<(), ConfigError> {
        if self.identity.device_id.len() != 64 || self.identity.device_id.chars().all(|c| c == '0')
        {
            return Err(ConfigError::Validation(
                "config: identity.device_id must be set to a real 64-char hex value. Run: npm run generate-identity"
                    .to_string(),
            ));
        }
        if self.auth.tokens.is_empty() {
            return Err(ConfigError::Validation(
                "config: auth.tokens must have at least one entry".to_string(),
            ));
        }
        if self.oauth.refresh_token.is_empty() {
            return Err(ConfigError::Validation(
                "config: oauth.refresh_token is required. Do a browser OAuth login on the admin machine, then copy the refresh token from ~/.claude/.credentials.json"
                    .to_string(),
            ));
        }
        Ok(())
    }

    pub fn get_env_value(&self, key: &str) -> Option<&JsonValue> {
        if let Some(profile) = &self.canonical_profile {
            profile.env.get(key)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_config() -> String {
        r#"
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
  node_version: "20.11.0"
  terminal: "zsh"
  package_managers: "npm,pnpm,yarn"
  runtimes: "node,bun"
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
  os_version: "macOS 14.0"
  working_dir: "/Users/jack/projects"
process:
  constrained_memory: 17179869184
  rss_range: [300000000, 500000000]
  heap_total_range: [100000000, 200000000]
  heap_used_range: [50000000, 150000000]
logging:
  level: "info"
  audit: true
"#
        .to_string()
    }

    #[test]
    fn test_load_valid_config() {
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file
            .write_all(create_test_config().as_bytes())
            .unwrap();

        let config = Config::load(temp_file.path()).unwrap();

        assert_eq!(config.server.port, 8443);
        assert_eq!(
            config.identity.device_id,
            "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"
        );
        assert_eq!(config.auth.tokens.len(), 1);
        assert_eq!(config.auth.tokens[0].name, "alice");
    }

    #[test]
    fn test_validation_empty_device_id() {
        let mut config_str = create_test_config();
        config_str = config_str.replace(
            "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
            "",
        );

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(config_str.as_bytes()).unwrap();

        let result = Config::load(temp_file.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_all_zeros_device_id() {
        let mut config_str = create_test_config();
        config_str = config_str.replace(
            "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
            "0000000000000000000000000000000000000000000000000000000000000000",
        );

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(config_str.as_bytes()).unwrap();

        let result = Config::load(temp_file.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_short_device_id() {
        let mut config_str = create_test_config();
        config_str = config_str.replace(
            "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
            "abc123def456",
        );

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(config_str.as_bytes()).unwrap();

        let result = Config::load(temp_file.path());
        assert!(result.is_err());
    }
}
