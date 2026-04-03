use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

/// Daemon 进程状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DaemonStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

/// Daemon 健康状态响应（匹配 daemon /_health 端点）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonHealth {
    pub status: String,
    pub oauth: String,
    pub canonical_device: String,
    pub canonical_platform: String,
    pub upstream: String,
    pub clients: Vec<String>,
}

/// Daemon 进程管理器
#[derive(Clone)]
pub struct DaemonProcess {
    pub status: Arc<Mutex<DaemonStatus>>,
    pub child: Arc<Mutex<Option<Child>>>,
    pub config_path: Arc<Mutex<Option<PathBuf>>>,
    pub port: Arc<Mutex<Option<u16>>>,
}

impl DaemonProcess {
    pub fn new() -> Self {
        Self {
            status: Arc::new(Mutex::new(DaemonStatus::Stopped)),
            child: Arc::new(Mutex::new(None)),
            config_path: Arc::new(Mutex::new(None)),
            port: Arc::new(Mutex::new(None)),
        }
    }

    /// 解析配置路径（显式或默认）
    pub fn resolve_config_path(explicit: Option<String>) -> Result<PathBuf, String> {
        if let Some(path_str) = explicit {
            let path = PathBuf::from(path_str);
            if !path.exists() {
                return Err(format!("Config file not found: {}", path.display()));
            }
            return Ok(path);
        }

        // 默认路径：~/.ccgw/config.yaml
        let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory")?;
        let default_path = home.join(".ccgw").join("config.yaml");
        if !default_path.exists() {
            return Err(format!(
                "Default config not found: {}",
                default_path.display()
            ));
        }
        Ok(default_path)
    }

    /// 查找 daemon 可执行文件
    fn find_daemon_binary() -> Result<PathBuf, String> {
        // 优先使用 workspace debug 构建产物
        let workspace_binary =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/debug/ccgw-daemon");
        if workspace_binary.exists() {
            return Ok(workspace_binary);
        }

        // 尝试从 PATH 查找
        which::which("ccgw-daemon")
            .map_err(|_| "ccgw-daemon binary not found in workspace or PATH".to_string())
    }

    /// 从配置文件读取端口
    fn read_port_from_config(config_path: &Path) -> Result<u16, String> {
        let config = ccgw_core::Config::load(config_path)
            .map_err(|e| format!("Failed to load config: {}", e))?;
        Ok(config.server.port)
    }

    /// 启动 daemon 子进程
    pub fn start(&self, config_path_str: Option<String>) -> Result<(), String> {
        let mut status = self.status.lock().unwrap();
        if *status != DaemonStatus::Stopped && *status != DaemonStatus::Failed {
            return Err(format!("Cannot start: current status is {:?}", *status));
        }
        *status = DaemonStatus::Starting;
        drop(status);

        let start_result: Result<(PathBuf, u16, Child), String> = (|| {
            let config_path = Self::resolve_config_path(config_path_str)?;
            let port = Self::read_port_from_config(&config_path)?;
            let daemon_binary = Self::find_daemon_binary()?;

            let child = Command::new(&daemon_binary)
                .arg(&config_path)
                .spawn()
                .map_err(|e| format!("Failed to spawn daemon: {}", e))?;

            Ok((config_path, port, child))
        })();

        let (config_path, port, child) = match start_result {
            Ok(values) => values,
            Err(err) => {
                let mut status = self.status.lock().unwrap();
                *status = DaemonStatus::Failed;
                return Err(err);
            }
        };

        {
            let mut child_guard = self.child.lock().unwrap();
            *child_guard = Some(child);
        }

        {
            let mut config_guard = self.config_path.lock().unwrap();
            *config_guard = Some(config_path);
        }

        {
            let mut port_guard = self.port.lock().unwrap();
            *port_guard = Some(port);
        }

        {
            let mut status = self.status.lock().unwrap();
            *status = DaemonStatus::Running;
        }

        Ok(())
    }

    /// 停止 daemon 子进程
    pub fn stop(&self) -> Result<(), String> {
        let mut status = self.status.lock().unwrap();
        if *status != DaemonStatus::Running {
            return Err(format!("Cannot stop: current status is {:?}", *status));
        }
        *status = DaemonStatus::Stopping;
        drop(status);

        let mut child_guard = self.child.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            child
                .kill()
                .map_err(|e| format!("Failed to kill daemon: {}", e))?;
            child
                .wait()
                .map_err(|e| format!("Failed to wait for daemon: {}", e))?;
        }

        {
            let mut status = self.status.lock().unwrap();
            *status = DaemonStatus::Stopped;
        }

        {
            let mut port_guard = self.port.lock().unwrap();
            *port_guard = None;
        }

        Ok(())
    }

    /// 查询当前状态
    pub fn get_status(&self) -> DaemonStatus {
        let status = self.status.lock().unwrap();
        status.clone()
    }

    /// 查询 daemon 健康状态（调用 /_health 端点）
    pub async fn get_health(&self) -> Result<DaemonHealth, String> {
        let url = self.health_url()?;
        let client = reqwest::Client::new();

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Health check request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Health check failed: {}", response.status()));
        }

        response
            .json::<DaemonHealth>()
            .await
            .map_err(|e| format!("Failed to parse health response: {}", e))
    }

    pub fn health_url(&self) -> Result<String, String> {
        let port = {
            let port_guard = self.port.lock().unwrap();
            port_guard.ok_or_else(|| "Daemon not running".to_string())?
        };

        Ok(format!("http://localhost:{}/_health", port))
    }
}

impl Default for DaemonProcess {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_config(dir: &Path, port: u16) -> PathBuf {
        let config_path = dir.join("config.yaml");
        let config_content = format!(
            r#"
server:
  port: {}
upstream:
  url: "https://api.anthropic.com"
oauth:
  access_token: "desktop-smoke-access-token"
  refresh_token: "test_refresh"
  expires_at: 4102444800000
auth:
  tokens:
    - name: "test"
      token: "test123"
identity:
  device_id: "test_device"
  email: "test@example.com"
  account_uuid: "test-account-uuid"
  session_id: "test-session-id"
env:
  platform: "darwin"
  platform_raw: "darwin"
  arch: "arm64"
  node_version: "20.11.0"
  terminal: "zsh"
  package_managers: "npm"
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
  os_version: "macOS 14.0"
  working_dir: "/Users/test"
process:
  constrained_memory: 17179869184
  rss_range: [300000000, 500000000]
  heap_total_range: [100000000, 200000000]
  heap_used_range: [50000000, 150000000]
logging:
  level: "info"
  audit: true
"#,
            port
        );
        fs::write(&config_path, config_content).unwrap();
        config_path
    }

    #[test]
    fn test_resolve_config_path_explicit() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = create_test_config(temp_dir.path(), 8443);

        let resolved =
            DaemonProcess::resolve_config_path(Some(config_path.to_string_lossy().to_string()))
                .unwrap();
        assert_eq!(resolved, config_path);
    }

    #[test]
    fn test_resolve_config_path_explicit_not_found() {
        let result = DaemonProcess::resolve_config_path(Some("/nonexistent/config.yaml".into()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_read_port_from_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = create_test_config(temp_dir.path(), 9999);

        let port = DaemonProcess::read_port_from_config(&config_path).unwrap();
        assert_eq!(port, 9999);
    }

    #[test]
    fn test_initial_status() {
        let daemon = DaemonProcess::new();
        assert_eq!(daemon.get_status(), DaemonStatus::Stopped);
    }

    #[test]
    fn test_status_transitions() {
        let daemon = DaemonProcess::new();
        {
            let mut status = daemon.status.lock().unwrap();
            *status = DaemonStatus::Starting;
        }
        assert_eq!(daemon.get_status(), DaemonStatus::Starting);

        {
            let mut status = daemon.status.lock().unwrap();
            *status = DaemonStatus::Running;
        }
        assert_eq!(daemon.get_status(), DaemonStatus::Running);
    }

    #[test]
    fn test_start_failure_sets_failed_status() {
        let daemon = DaemonProcess::new();

        let result = daemon.start(Some("/nonexistent/config.yaml".to_string()));

        assert!(result.is_err());
        assert_eq!(daemon.get_status(), DaemonStatus::Failed);
    }

    #[tokio::test]
    async fn test_start_health_stop_with_real_daemon_binary() {
        let temp_dir = TempDir::new().unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let config_path = create_test_config(temp_dir.path(), port);
        let daemon = DaemonProcess::new();

        daemon
            .start(Some(config_path.to_string_lossy().to_string()))
            .unwrap();

        let mut health = None;
        for _ in 0..20 {
            if let Ok(current_health) = daemon.get_health().await {
                health = Some(current_health);
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        }

        daemon.stop().unwrap();

        let health = health.expect("daemon health never became ready");
        assert_eq!(health.status, "ok");
        assert_eq!(health.oauth, "valid");
        assert_eq!(daemon.get_status(), DaemonStatus::Stopped);
    }
}
