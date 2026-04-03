use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;

/// CLI 配置，优先从用户配置文件读取，缺失时回退到环境变量
#[derive(Debug, Clone)]
pub struct CliConfig {
    /// Gateway 地址
    pub gateway_url: String,
    /// 客户端令牌
    pub client_token: String,
}

impl CliConfig {
    /// 加载配置：优先读取用户配置文件，缺失时回退环境变量
    pub fn load() -> Result<Self> {
        // 尝试从用户配置文件加载
        if let Some(config) = Self::try_load_from_file()? {
            return Ok(config);
        }

        // 回退到环境变量
        Self::load_from_env()
    }

    /// 尝试从用户配置文件加载
    fn try_load_from_file() -> Result<Option<Self>> {
        let config_path = Self::config_file_path()?;

        if !config_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&config_path)
            .with_context(|| format!("Failed to read config file: {:?}", config_path))?;

        let config: serde_json::Value = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse config file: {:?}", config_path))?;

        let gateway_url = config["gateway_url"]
            .as_str()
            .context("Missing or invalid 'gateway_url' in config file")?
            .to_string();

        let client_token = config["client_token"]
            .as_str()
            .context("Missing or invalid 'client_token' in config file")?
            .to_string();

        Ok(Some(Self {
            gateway_url,
            client_token,
        }))
    }

    /// 从环境变量加载
    fn load_from_env() -> Result<Self> {
        let gateway_url = env::var("CCG_GATEWAY_URL")
            .context("CCG_GATEWAY_URL environment variable not set and no config file found")?;

        let client_token = env::var("CCG_CLIENT_TOKEN")
            .context("CCG_CLIENT_TOKEN environment variable not set and no config file found")?;

        Ok(Self {
            gateway_url,
            client_token,
        })
    }

    /// 获取配置文件路径：~/.config/cc-gateway/config.json
    fn config_file_path() -> Result<PathBuf> {
        if let Ok(explicit_path) = env::var("CCG_CONFIG_PATH") {
            return Ok(PathBuf::from(explicit_path));
        }

        let config_dir = dirs::config_dir().context("Unable to determine config directory")?;

        Ok(config_dir.join("cc-gateway").join("config.json"))
    }

    /// 获取 daemon 健康检查 URL
    pub fn health_url(&self) -> String {
        format!("{}/_health", self.gateway_url)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::env_lock;

    fn cleanup_env() {
        env::remove_var("XDG_CONFIG_HOME");
        env::remove_var("CCG_CONFIG_PATH");
        env::remove_var("CCG_GATEWAY_URL");
        env::remove_var("CCG_CLIENT_TOKEN");
    }

    #[test]
    fn test_load_from_env() {
        let _guard = env_lock();
        cleanup_env();

        env::set_var("CCG_GATEWAY_URL", "http://localhost:8443");
        env::set_var("CCG_CLIENT_TOKEN", "test-token-123");

        let config = CliConfig::load().unwrap();

        assert_eq!(config.gateway_url, "http://localhost:8443");
        assert_eq!(config.client_token, "test-token-123");

        cleanup_env();
    }

    #[test]
    fn test_load_from_file_fallback_to_env() {
        let _guard = env_lock();
        cleanup_env();

        let temp_dir = tempfile::tempdir().unwrap();
        env::set_var(
            "CCG_CONFIG_PATH",
            temp_dir
                .path()
                .join("missing-config.json")
                .display()
                .to_string(),
        );
        env::set_var("CCG_GATEWAY_URL", "http://fallback:8443");
        env::set_var("CCG_CLIENT_TOKEN", "fallback-token");

        let config = CliConfig::load().unwrap();

        assert_eq!(config.gateway_url, "http://fallback:8443");
        assert_eq!(config.client_token, "fallback-token");

        cleanup_env();
    }

    #[test]
    fn test_missing_env_vars() {
        let _guard = env_lock();
        cleanup_env();

        let temp_dir = tempfile::tempdir().unwrap();
        env::set_var(
            "CCG_CONFIG_PATH",
            temp_dir
                .path()
                .join("missing-config.json")
                .display()
                .to_string(),
        );

        let result = CliConfig::load();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("CCG_GATEWAY_URL") || err_msg.contains("config"));

        cleanup_env();
    }

    #[test]
    fn test_health_url() {
        let config = CliConfig {
            gateway_url: "http://localhost:8443".to_string(),
            client_token: "test".to_string(),
        };

        assert_eq!(config.health_url(), "http://localhost:8443/_health");
    }

    #[test]
    fn test_load_from_file_prioritized_over_env() {
        let _guard = env_lock();
        cleanup_env();

        let temp_dir = tempfile::tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        std::fs::write(
            &config_path,
            r#"{"gateway_url":"http://file:8443","client_token":"file-token"}"#,
        )
        .unwrap();

        env::set_var("CCG_CONFIG_PATH", config_path.display().to_string());
        env::set_var("CCG_GATEWAY_URL", "http://env:8443");
        env::set_var("CCG_CLIENT_TOKEN", "env-token");

        let config = CliConfig::load().unwrap();
        assert_eq!(config.gateway_url, "http://file:8443");
        assert_eq!(config.client_token, "file-token");

        cleanup_env();
    }
}
