use std::sync::{Arc, Mutex};

use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{HeaderMap, Request};
use axum::response::IntoResponse;
use axum::routing::any;
use axum::{Json, Router};
use base64::Engine;
use ccgw_core::Config;
use ccgw_daemon::build_app;
use chrono::{Duration as ChronoDuration, Utc};
use serde_json::{json, Value};
#[derive(Clone, Debug)]
struct CapturedRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Clone)]
struct CaptureState {
    captured: Arc<Mutex<Vec<CapturedRequest>>>,
}

#[tokio::test]
async fn health_endpoint_is_public() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;

    let response = reqwest::get(format!("{}/_health", daemon.base_url))
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let payload: Value = response.json().await.unwrap();
    assert_eq!(payload["status"], "ok");
    assert_eq!(payload["oauth"], "valid");
    assert_eq!(payload["canonical_platform"], "darwin");
    assert_eq!(payload["clients"][0], "alice");
}

#[tokio::test]
async fn verify_endpoint_requires_auth_and_returns_rewrite_preview() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let unauthorized = client
        .get(format!("{}/_verify", daemon.base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(unauthorized.status(), reqwest::StatusCode::UNAUTHORIZED);

    let authorized = client
        .get(format!("{}/_verify", daemon.base_url))
        .header("x-api-key", "client-token")
        .send()
        .await
        .unwrap();
    assert_eq!(authorized.status(), reqwest::StatusCode::OK);

    let payload: Value = authorized.json().await.unwrap();
    assert_eq!(
        payload["after"]["metadata.user_id"]["device_id"],
        "canonical-device-id"
    );
    assert_eq!(payload["after"]["billing_header"], "(stripped)");
    assert_eq!(payload["after"]["system_block_count"], 1);
    assert!(payload["after"]["system_prompt_env"]
        .as_str()
        .unwrap()
        .contains("/Users/canonical/project"));
}

#[tokio::test]
async fn proxy_forwards_authenticated_requests_with_rewrites_and_oauth_token() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let request_body = json!({
        "metadata": {
            "user_id": serde_json::to_string(&json!({
                "device_id": "real-device",
                "account_uuid": "acct-1"
            })).unwrap()
        },
        "system": [
            { "type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.81.a1b;" },
            { "type": "text", "text": "Working directory: /home/bob/repo\nPlatform: linux\nShell: bash\nOS Version: Linux" }
        ],
        "messages": [{
            "role": "user",
            "content": "<system-reminder>Working directory: /home/bob/repo</system-reminder>"
        }]
    });

    let response = client
        .post(format!("{}/v1/messages?foo=bar", daemon.base_url))
        .header("x-api-key", "client-token")
        .header("user-agent", "claude-code/2.0.0 (external, cli)")
        .json(&request_body)
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);
    let response_json: Value = response.json().await.unwrap();
    assert_eq!(response_json["ok"], true);

    let captured = wait_for_captured_request(&upstream.captured).await;
    assert_eq!(captured.method, "POST");
    assert_eq!(captured.path, "/v1/messages?foo=bar");
    assert_eq!(
        header_value(&captured.headers, "x-api-key"),
        Some("oauth-access")
    );
    assert_eq!(
        header_value(&captured.headers, "user-agent"),
        Some("claude-code/2.1.81 (external, cli)")
    );

    let forwarded_body: Value = serde_json::from_slice(&captured.body).unwrap();
    let metadata: Value =
        serde_json::from_str(forwarded_body["metadata"]["user_id"].as_str().unwrap()).unwrap();
    assert_eq!(metadata["device_id"], "canonical-device-id");
    assert_eq!(forwarded_body["system"].as_array().unwrap().len(), 1);
    assert!(forwarded_body["system"][0]["text"]
        .as_str()
        .unwrap()
        .contains("/Users/canonical/project"));
    assert!(forwarded_body["messages"][0]["content"]
        .as_str()
        .unwrap()
        .contains("/Users/canonical/project"));
}

#[tokio::test]
async fn proxy_prefers_canonical_profile_version_and_platform() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config_with_canonical_profile(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let health = client
        .get(format!("{}/_health", daemon.base_url))
        .send()
        .await
        .unwrap();

    assert_eq!(health.status(), reqwest::StatusCode::OK);
    let health_json: Value = health.json().await.unwrap();
    assert_eq!(health_json["canonical_platform"], "linux");

    let response = client
        .post(format!("{}/v1/messages", daemon.base_url))
        .header("x-api-key", "client-token")
        .header("user-agent", "claude-code/2.0.0 (external, cli)")
        .json(&json!({
            "messages": [{ "role": "user", "content": "hello" }],
            "system": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);

    let captured = wait_for_captured_request(&upstream.captured).await;
    assert_eq!(
        header_value(&captured.headers, "user-agent"),
        Some("claude-code/2.2.0 (external, cli)")
    );
}

#[tokio::test]
async fn proxy_returns_typescript_oauth_unavailable_message() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config_with_soon_expiring_oauth(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;

    let response = client
        .post(format!("{}/v1/messages", daemon.base_url))
        .header("x-api-key", "client-token")
        .json(&json!({
            "messages": [{ "role": "user", "content": "hello" }],
            "system": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::SERVICE_UNAVAILABLE);
    let body: Value = response.json().await.unwrap();
    assert_eq!(
        body["error"],
        "OAuth token unavailable after refresh attempt"
    );
}

#[tokio::test]
async fn proxy_strips_sensitive_headers_and_preserves_non_json_body() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();
    let raw_body = "plain text body that should pass through unchanged";

    let response = client
        .post(format!("{}/v1/messages", daemon.base_url))
        .header("content-type", "text/plain")
        .header("x-api-key", "client-token")
        .header("authorization", "Bearer should-not-forward")
        .header("proxy-authorization", "Basic should-not-forward")
        .header("x-anthropic-billing-header", "cc_version=2.1.81.a1b")
        .header("user-agent", "claude-code/2.0.0 (external, cli)")
        .body(raw_body.to_string())
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);

    let captured = wait_for_captured_request(&upstream.captured).await;
    assert_eq!(captured.path, "/v1/messages");
    assert_eq!(
        header_value(&captured.headers, "x-api-key"),
        Some("oauth-access")
    );
    assert_eq!(
        header_value(&captured.headers, "user-agent"),
        Some("claude-code/2.1.81 (external, cli)")
    );
    assert_eq!(
        header_value(&captured.headers, "content-type"),
        Some("text/plain")
    );
    assert_eq!(header_value(&captured.headers, "authorization"), None);
    assert_eq!(header_value(&captured.headers, "proxy-authorization"), None);
    assert_eq!(
        header_value(&captured.headers, "x-anthropic-billing-header"),
        None
    );
    assert_eq!(String::from_utf8(captured.body).unwrap(), raw_body);
}

#[tokio::test]
async fn proxy_rewrites_policy_limits_generic_identity_payloads() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let request_body = json!({
        "device_id": "old-device",
        "email": "old@example.com",
        "account_uuid": "old-account",
        "session_id": "old-session",
        "other_field": "preserved"
    });

    let response = client
        .post(format!("{}/policy_limits", daemon.base_url))
        .header("x-api-key", "client-token")
        .json(&request_body)
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);

    let captured = wait_for_captured_request(&upstream.captured).await;
    assert_eq!(captured.path, "/policy_limits");
    assert_eq!(
        header_value(&captured.headers, "x-api-key"),
        Some("oauth-access")
    );

    let forwarded_body: Value = serde_json::from_slice(&captured.body).unwrap();
    assert_eq!(forwarded_body["device_id"], "canonical-device-id");
    assert_eq!(forwarded_body["email"], "canonical@example.com");
    assert_eq!(forwarded_body["account_uuid"], "canonical-account-uuid");
    assert_eq!(forwarded_body["session_id"], "canonical-session-id");
    assert_eq!(forwarded_body["other_field"], "preserved");
}

#[tokio::test]
async fn proxy_rewrites_settings_generic_identity_payloads() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let request_body = json!({
        "device_id": "old-device",
        "email": "old@example.com",
        "account_uuid": "old-account",
        "session_id": "old-session",
        "other_field": "preserved"
    });

    let response = client
        .post(format!("{}/settings", daemon.base_url))
        .header("x-api-key", "client-token")
        .json(&request_body)
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);

    let captured = wait_for_captured_request(&upstream.captured).await;
    assert_eq!(captured.path, "/settings");

    let forwarded_body: Value = serde_json::from_slice(&captured.body).unwrap();
    assert_eq!(forwarded_body["device_id"], "canonical-device-id");
    assert_eq!(forwarded_body["email"], "canonical@example.com");
    assert_eq!(forwarded_body["account_uuid"], "canonical-account-uuid");
    assert_eq!(forwarded_body["session_id"], "canonical-session-id");
    assert_eq!(forwarded_body["other_field"], "preserved");
}

#[tokio::test]
async fn proxy_recursively_sanitizes_identity_fields_in_additional_metadata() {
    let upstream = spawn_upstream().await;
    let daemon = spawn_daemon(test_config(&upstream.base_url)).await;
    let client = reqwest::Client::new();

    let metadata = json!({
        "baseUrl": "https://gateway.example",
        "user": {
            "device_id": "old-device",
            "email": "old@example.com",
            "account_uuid": "old-account",
            "session_id": "old-session"
        },
        "nested": {
            "deeper": {
                "device_id": "nested-device",
                "account_uuid": "nested-account"
            }
        }
    });

    let response = client
        .post(format!("{}/api/event_logging/batch", daemon.base_url))
        .header("x-api-key", "client-token")
        .json(&json!({
            "events": [{
                "event_type": "ClaudeCodeInternalEvent",
                "event_data": {
                    "device_id": "top-level",
                    "additional_metadata": base64::engine::general_purpose::STANDARD
                        .encode(metadata.to_string())
                }
            }]
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::CREATED);

    let captured = wait_for_captured_request(&upstream.captured).await;
    let forwarded_body: Value = serde_json::from_slice(&captured.body).unwrap();
    let encoded = forwarded_body["events"][0]["event_data"]["additional_metadata"]
        .as_str()
        .unwrap();
    let decoded: Value = serde_json::from_slice(
        &base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap(),
    )
    .unwrap();

    assert_eq!(decoded["baseUrl"], Value::Null);
    assert_eq!(decoded["user"]["device_id"], "canonical-device-id");
    assert_eq!(decoded["user"]["email"], "canonical@example.com");
    assert_eq!(decoded["user"]["account_uuid"], "canonical-account-uuid");
    assert_eq!(decoded["user"]["session_id"], "canonical-session-id");
    assert_eq!(
        decoded["nested"]["deeper"]["device_id"],
        "canonical-device-id"
    );
    assert_eq!(
        decoded["nested"]["deeper"]["account_uuid"],
        "canonical-account-uuid"
    );
}

fn test_config(upstream_url: &str) -> Config {
    serde_json::from_value(json!({
        "server": { "port": 0, "tls": null },
        "upstream": { "url": upstream_url },
        "oauth": {
            "access_token": "oauth-access",
            "refresh_token": "refresh-token",
            "expires_at": (Utc::now() + ChronoDuration::minutes(10)).timestamp_millis()
        },
        "auth": {
            "tokens": [{ "name": "alice", "token": "client-token" }]
        },
        "identity": {
            "device_id": "canonical-device-id",
            "email": "canonical@example.com",
            "account_uuid": "canonical-account-uuid",
            "session_id": "canonical-session-id"
        },
        "env": {
            "platform": "darwin",
            "platform_raw": "darwin",
            "arch": "arm64",
            "node_version": "24.3.0",
            "terminal": "zsh",
            "package_managers": "npm,pnpm",
            "runtimes": "node",
            "is_running_with_bun": false,
            "is_ci": false,
            "is_claubbit": false,
            "is_claude_code_remote": false,
            "is_local_agent_mode": false,
            "is_conductor": false,
            "is_github_action": false,
            "is_claude_code_action": false,
            "is_claude_ai_auth": true,
            "version": "2.1.81",
            "version_base": "2.1.81",
            "build_time": "2026-01-01T00:00:00Z",
            "deployment_environment": "development",
            "vcs": "git"
        },
        "prompt_env": {
            "platform": "darwin",
            "shell": "zsh",
            "os_version": "Darwin 24.4.0",
            "working_dir": "/Users/canonical/project"
        },
        "process": {
            "constrained_memory": 17179869184u64,
            "rss_range": [300000000u64, 300000001u64],
            "heap_total_range": [100000000u64, 100000001u64],
            "heap_used_range": [50000000u64, 50000001u64]
        },
        "logging": { "level": "info", "audit": false }
    }))
    .unwrap()
}

fn test_config_with_canonical_profile(upstream_url: &str) -> Config {
    let mut config = test_config(upstream_url);
    config.canonical_profile = Some(ccgw_core::config::CanonicalProfile {
        version: "1.0".to_string(),
        identity: config.identity.clone(),
        env: serde_json::from_str(
            r#"{
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
                "total_memory": 68719476736,
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
                "boot_time": "2026-03-01T08:00:00Z"
            }"#,
        )
        .unwrap(),
        prompt_env: ccgw_core::config::PromptEnvConfig {
            platform: "linux".to_string(),
            shell: "bash".to_string(),
            os_version: "Linux 6.5.0".to_string(),
            working_dir: "/home/deploy/work".to_string(),
        },
        process: config.process.clone(),
        rewrite_policy: None,
    });
    config
}

fn test_config_with_soon_expiring_oauth(upstream_url: &str) -> Config {
    let mut config = test_config(upstream_url);
    config.oauth.expires_at = Some((Utc::now() + ChronoDuration::seconds(1)).timestamp_millis());
    config
}

struct SpawnedServer {
    base_url: String,
    handle: tokio::task::JoinHandle<()>,
}

impl Drop for SpawnedServer {
    fn drop(&mut self) {
        self.handle.abort();
    }
}

struct SpawnedUpstream {
    base_url: String,
    captured: Arc<Mutex<Vec<CapturedRequest>>>,
    handle: tokio::task::JoinHandle<()>,
}

impl Drop for SpawnedUpstream {
    fn drop(&mut self) {
        self.handle.abort();
    }
}

async fn spawn_daemon(config: Config) -> SpawnedServer {
    let app = build_app(config).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    SpawnedServer {
        base_url: format!("http://{}", addr),
        handle,
    }
}

async fn spawn_upstream() -> SpawnedUpstream {
    let captured = Arc::new(Mutex::new(Vec::new()));
    let app = Router::new()
        .route("/", any(capture_handler))
        .route("/*path", any(capture_handler))
        .with_state(CaptureState {
            captured: captured.clone(),
        });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    SpawnedUpstream {
        base_url: format!("http://{}", addr),
        captured,
        handle,
    }
}

async fn capture_handler(
    State(state): State<CaptureState>,
    request: Request<Body>,
) -> impl IntoResponse {
    let method = request.method().to_string();
    let path = request
        .uri()
        .path_and_query()
        .map(|value| value.as_str().to_string())
        .unwrap_or_else(|| "/".to_string());
    let headers = request.headers().clone();
    let body = to_bytes(request.into_body(), usize::MAX).await.unwrap();

    state.captured.lock().unwrap().push(CapturedRequest {
        method,
        path,
        headers: headers_to_vec(&headers),
        body: body.to_vec(),
    });

    (axum::http::StatusCode::CREATED, Json(json!({ "ok": true })))
}

async fn wait_for_captured_request(captured: &Arc<Mutex<Vec<CapturedRequest>>>) -> CapturedRequest {
    for _ in 0..100 {
        if let Some(request) = captured.lock().unwrap().pop() {
            return request;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }

    panic!("timed out waiting for upstream request capture");
}

fn headers_to_vec(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect()
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(header_name, _)| header_name.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.as_str())
}
