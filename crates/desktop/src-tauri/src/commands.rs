use crate::daemon::{DaemonHealth, DaemonProcess, DaemonStatus};
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct DaemonState(pub Arc<Mutex<DaemonProcess>>);

#[tauri::command]
pub async fn start_daemon(
    config_path: Option<String>,
    state: State<'_, DaemonState>,
) -> Result<(), String> {
    {
        let daemon = state.0.lock().unwrap();
        daemon.start(config_path)?;
    }

    for _ in 0..20 {
        let health_url = {
            let daemon = state.0.lock().unwrap();
            daemon.health_url()
        };

        if let Ok(url) = health_url {
            let client = reqwest::Client::new();
            if let Ok(response) = client.get(&url).send().await {
                if response.status().is_success() {
                    return Ok(());
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }

    Err("Daemon started but health check did not become ready in time".to_string())
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
