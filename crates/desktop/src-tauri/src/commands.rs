use crate::daemon::{DaemonHealth, DaemonProcess, DaemonStatus};
use crate::settings::DesktopSettings;
use ccgw_core::Config;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

pub struct DaemonState(pub Arc<Mutex<DaemonProcess>>);

const EXAMPLE_CONFIG: &str = include_str!("../../../../config.example.yaml");

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSummary {
    pub port: u16,
    pub upstream: String,
    pub device_id: String,
    pub clients: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSnapshot {
    pub path: String,
    pub exists: bool,
    pub content: String,
    pub summary: Option<ConfigSummary>,
    pub validation_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSnapshot {
    pub path: String,
    pub exists: bool,
    pub lines: Vec<String>,
}

fn requested_config_path(config_path: Option<String>) -> Result<PathBuf, String> {
    match config_path {
        Some(path) => Ok(PathBuf::from(path)),
        None => DaemonProcess::default_config_path(),
    }
}

fn build_config_summary(config: &Config) -> ConfigSummary {
    ConfigSummary {
        port: config.server.port,
        upstream: config.upstream.url.clone(),
        device_id: config.identity.device_id.clone(),
        clients: config
            .auth
            .tokens
            .iter()
            .map(|token| token.name.clone())
            .collect(),
    }
}

fn read_config_snapshot(path: &Path) -> Result<ConfigSnapshot, String> {
    if !path.exists() {
        return Ok(ConfigSnapshot {
            path: path.display().to_string(),
            exists: false,
            content: EXAMPLE_CONFIG.to_string(),
            summary: None,
            validation_error: None,
        });
    }

    let content =
        fs::read_to_string(path).map_err(|error| format!("Failed to read config file: {error}"))?;

    match Config::load(path) {
        Ok(config) => Ok(ConfigSnapshot {
            path: path.display().to_string(),
            exists: true,
            content,
            summary: Some(build_config_summary(&config)),
            validation_error: None,
        }),
        Err(error) => Ok(ConfigSnapshot {
            path: path.display().to_string(),
            exists: true,
            content,
            summary: None,
            validation_error: Some(error.to_string()),
        }),
    }
}

fn write_validated_config(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Config path must have a parent directory".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create config directory: {error}"))?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to generate temporary config name: {error}"))?
        .as_millis();
    let temp_path = parent.join(format!(".config.{stamp}.tmp"));

    fs::write(&temp_path, content)
        .map_err(|error| format!("Failed to write config draft: {error}"))?;

    if let Err(error) = Config::load(&temp_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Config validation failed: {error}"));
    }

    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Failed to replace config file: {error}"))?;
    }

    fs::rename(&temp_path, path).map_err(|error| format!("Failed to save config file: {error}"))
}

fn tail_lines(path: &Path, limit: usize) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(path).map_err(|error| format!("Failed to read log file: {error}"))?;
    let mut lines: Vec<String> = content.lines().map(|line| line.to_string()).collect();
    if lines.len() > limit {
        lines = lines.split_off(lines.len() - limit);
    }
    Ok(lines)
}

fn daemon_start_failure_message(daemon: &DaemonProcess, prefix: &str) -> String {
    let mut message = prefix.to_string();

    if let Ok(path) = daemon.log_path() {
        if let Ok(lines) = tail_lines(&path, 20) {
            let mut recent = lines
                .into_iter()
                .map(|line| line.trim().to_string())
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>();

            if recent.len() > 6 {
                recent = recent.split_off(recent.len() - 6);
            }

            if !recent.is_empty() {
                message.push_str(&format!(
                    " Recent daemon log ({}) => {}",
                    path.display(),
                    recent.join(" | ")
                ));
            }
        }
    }

    message
}

#[tauri::command]
pub async fn start_daemon(
    config_path: Option<String>,
    state: State<'_, DaemonState>,
) -> Result<(), String> {
    let daemon = {
        let daemon = state.0.lock().unwrap();
        daemon.start(config_path)?;
        daemon.clone()
    };

    let client = reqwest::Client::new();

    for _ in 0..20 {
        if let Ok(url) = daemon.health_url() {
            if let Ok(response) = client.get(&url).send().await {
                if response.status().is_success()
                    || response.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE
                {
                    return Ok(());
                }
            }
        }

        if let Some(code) = daemon.poll_exit()? {
            return Err(daemon_start_failure_message(
                &daemon,
                &format!("Daemon exited before becoming healthy (code {code})."),
            ));
        }

        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }

    Err(daemon_start_failure_message(
        &daemon,
        "Daemon started but health check did not become ready in time.",
    ))
}

#[tauri::command]
pub async fn stop_daemon(state: State<'_, DaemonState>) -> Result<(), String> {
    let daemon = state.0.lock().unwrap();
    daemon.stop()
}

#[tauri::command]
pub async fn get_daemon_status(state: State<'_, DaemonState>) -> Result<DaemonStatus, String> {
    let daemon = state.0.lock().unwrap();
    Ok(daemon.get_status())
}

#[tauri::command]
pub async fn get_daemon_health(state: State<'_, DaemonState>) -> Result<DaemonHealth, String> {
    let daemon = {
        let guard = state.0.lock().unwrap();
        guard.clone()
    };

    daemon.get_health().await
}

#[tauri::command]
pub async fn get_config_snapshot(config_path: Option<String>) -> Result<ConfigSnapshot, String> {
    let path = requested_config_path(config_path)?;
    read_config_snapshot(&path)
}

#[tauri::command]
pub async fn save_config_snapshot(
    content: String,
    config_path: Option<String>,
) -> Result<ConfigSnapshot, String> {
    let path = requested_config_path(config_path)?;
    write_validated_config(&path, &content)?;
    read_config_snapshot(&path)
}

#[tauri::command]
pub async fn get_daemon_logs(
    limit: Option<usize>,
    state: State<'_, DaemonState>,
) -> Result<LogSnapshot, String> {
    let daemon = {
        let guard = state.0.lock().unwrap();
        guard.clone()
    };
    let path = daemon.log_path()?;
    let lines = tail_lines(&path, limit.unwrap_or(200))?;

    Ok(LogSnapshot {
        path: path.display().to_string(),
        exists: path.exists(),
        lines,
    })
}

#[tauri::command]
pub async fn get_desktop_settings() -> Result<DesktopSettings, String> {
    DesktopSettings::load()
}

#[tauri::command]
pub async fn set_start_minimized(start_minimized: bool) -> Result<DesktopSettings, String> {
    let settings = DesktopSettings { start_minimized };
    settings.save()?;
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::{
        daemon_start_failure_message, read_config_snapshot, tail_lines, write_validated_config,
        EXAMPLE_CONFIG,
    };
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn missing_config_uses_example_template() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("config.yaml");

        let snapshot = read_config_snapshot(&path).unwrap();

        assert!(!snapshot.exists);
        assert!(snapshot.content.contains("server:"));
        assert_eq!(snapshot.content, EXAMPLE_CONFIG);
    }

    #[test]
    fn write_validated_config_persists_valid_yaml() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("config.yaml");
        let content = r#"
server:
  port: 8443
upstream:
  url: "https://api.anthropic.com"
oauth:
  refresh_token: "test_refresh"
auth:
  tokens:
    - name: "desktop"
      token: "secret"
identity:
  device_id: "d1a2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"
  email: "test@example.com"
  account_uuid: "account-uuid"
  session_id: "session-id"
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
  working_dir: "/Users/test"
process:
  constrained_memory: 17179869184
  rss_range: [300000000, 500000000]
  heap_total_range: [100000000, 200000000]
  heap_used_range: [50000000, 150000000]
logging:
  level: "info"
  audit: true
"#;

        write_validated_config(&path, content).unwrap();

        let saved = fs::read_to_string(&path).unwrap();
        assert_eq!(saved, content);
    }

    #[test]
    fn tail_lines_returns_last_entries() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("desktop.log");
        fs::write(&path, "one\ntwo\nthree\nfour\n").unwrap();

        let lines = tail_lines(&path, 2).unwrap();

        assert_eq!(lines, vec!["three", "four"]);
    }

    #[test]
    fn daemon_start_failure_message_includes_recent_logs() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("desktop-daemon.log");
        fs::write(&log_path, "one\ntwo\nthree\n").unwrap();

        let daemon = crate::daemon::DaemonProcess::new();
        *daemon.log_path.lock().unwrap() = Some(log_path.clone());

        let message = daemon_start_failure_message(&daemon, "prefix");

        assert!(message.contains("prefix"));
        assert!(message.contains("desktop-daemon.log"));
        assert!(message.contains("one | two | three"));
    }
}
