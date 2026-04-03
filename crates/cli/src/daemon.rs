use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub oauth: String,
    pub canonical_device: String,
    pub canonical_platform: String,
    pub upstream: String,
    pub clients: Vec<String>,
}

/// 检查 daemon 健康状态
pub async fn check_daemon_health(url: &str) -> Result<HealthResponse> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .context("Failed to build HTTP client")?;

    let response = client
        .get(url)
        .send()
        .await
        .context("Failed to connect to daemon")?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Daemon returned error status: {}",
            response.status()
        ));
    }

    let health = response
        .json::<HealthResponse>()
        .await
        .context("Failed to parse health response")?;

    Ok(health)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_health_invalid_url() {
        let result = check_daemon_health("http://localhost:1").await;
        assert!(result.is_err());
    }
}
