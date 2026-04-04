use std::net::SocketAddr;

use anyhow::Context;
use axum::body::{to_bytes, Body};
use axum::extract::{OriginalUri, State};
use axum::http::{header::CONTENT_TYPE, HeaderMap, Method, Response, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{any, get};
use axum::{Json, Router};
use base64::Engine;
use ccgw_core::{
    rewrite_event_env, rewrite_event_identity, rewrite_event_process, rewrite_generic_identity,
    rewrite_headers, rewrite_messages_metadata, rewrite_prompt_text, rewrite_system_reminders,
    AuthManager, Config, OAuthManager,
};
use reqwest::{Client, Proxy};
use serde_json::{json, Value};
use tracing::{error, info, warn};
use url::Url;

#[derive(Clone)]
struct AppState {
    config: Config,
    auth: AuthManager,
    oauth: OAuthManager,
    upstream: Url,
    client: Client,
}

pub async fn run(config: Config) -> anyhow::Result<()> {
    let state = build_state(config).await?;
    let port = state.config.server.port;
    let app = router(state.clone());
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .context("failed to bind daemon listener")?;
    let local_addr = listener.local_addr().context("failed to read local addr")?;

    log_startup(&state, local_addr);

    axum::serve(listener, app)
        .await
        .context("daemon server exited unexpectedly")
}

pub async fn build_app(config: Config) -> anyhow::Result<Router> {
    Ok(router(build_state(config).await?))
}

async fn build_state(config: Config) -> anyhow::Result<AppState> {
    let oauth = OAuthManager::from_config(&config.oauth)?;
    oauth.init().await?;

    let upstream = Url::parse(&config.upstream.url).context("invalid upstream url")?;
    let client = build_client()?;
    let auth = AuthManager::new(config.auth.tokens.clone());

    Ok(AppState {
        config,
        auth,
        oauth,
        upstream,
        client,
    })
}

fn router(state: AppState) -> Router {
    Router::new()
        .route("/_health", get(health_handler))
        .route("/_verify", get(verify_handler))
        .route("/", any(proxy_handler))
        .route("/*path", any(proxy_handler))
        .with_state(state)
}

fn log_startup(state: &AppState, local_addr: SocketAddr) {
    info!("CC Gateway Daemon starting");
    info!("CC Gateway listening on http://{}", local_addr);
    info!("Upstream: {}", state.config.upstream.url);
    info!(
        "Canonical device_id: {}...",
        state
            .config
            .identity
            .device_id
            .chars()
            .take(8)
            .collect::<String>()
    );
    info!(
        "Authorized clients: {}",
        state
            .config
            .auth
            .tokens
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    );
}

fn build_client() -> anyhow::Result<Client> {
    let mut builder = Client::builder();

    if let Some(proxy_url) = ccgw_core::get_proxy_url() {
        builder = builder.proxy(Proxy::all(proxy_url.as_str())?);
    }

    Ok(builder.build()?)
}

async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let oauth_ok = state.oauth.get_access_token().is_some();
    let status = if oauth_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(json!({
            "status": if oauth_ok { "ok" } else { "degraded" },
            "oauth": if oauth_ok { "valid" } else { "expired/refreshing" },
            "canonical_device": format!(
                "{}...",
                state.config.identity.device_id.chars().take(8).collect::<String>()
            ),
            "canonical_platform": state
                .config
                .get_env_value("platform")
                .and_then(Value::as_str)
                .unwrap_or(&state.config.env.platform),
            "upstream": state.config.upstream.url,
            "clients": state
                .config
                .auth
                .tokens
                .iter()
                .map(|entry| entry.name.clone())
                .collect::<Vec<_>>(),
        })),
    )
}

async fn verify_handler(State(state): State<AppState>, headers: HeaderMap) -> Response<Body> {
    let Some(_client_name) = state.auth.authenticate(&headers) else {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized");
    };

    match build_verification_payload(&state.config) {
        Ok(payload) => Json(payload).into_response(),
        Err(err) => {
            error!("Failed to build verification payload: {err:#}");
            json_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build verification payload",
            )
        }
    }
}

async fn proxy_handler(
    State(state): State<AppState>,
    method: Method,
    headers: HeaderMap,
    OriginalUri(uri): OriginalUri,
    body: Body,
) -> Response<Body> {
    let path = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or("/")
        .to_string();

    let Some(client_name) = state.auth.authenticate(&headers) else {
        warn!("Unauthorized request: {} {}", method, path);
        return json_error(
            StatusCode::UNAUTHORIZED,
            "Unauthorized - provide client token via x-api-key header",
        );
    };

    let Some(oauth_token) = state.oauth.get_access_token() else {
        error!("No valid OAuth token available");
        return json_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "OAuth token unavailable after refresh attempt",
        );
    };

    let request_bytes = match to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(err) => {
            error!("Failed reading request body: {err}");
            return json_error(StatusCode::BAD_REQUEST, "Failed to read request body");
        }
    };

    let rewritten_body = rewrite_request_body(&request_bytes, uri.path(), &state.config);
    let upstream_url = match state.upstream.join(&path) {
        Ok(url) => url,
        Err(err) => {
            error!("Invalid upstream path {path}: {err}");
            return json_error(StatusCode::BAD_REQUEST, "Invalid upstream request path");
        }
    };

    let version = state
        .config
        .get_env_value("version")
        .and_then(Value::as_str)
        .unwrap_or(&state.config.env.version);
    let mut upstream_headers = rewrite_headers(&headers, version);
    upstream_headers.remove(axum::http::header::CONTENT_LENGTH);
    upstream_headers.insert(
        "x-api-key",
        oauth_token.parse().expect("valid oauth token header"),
    );

    let reqwest_method = match method.as_str().parse::<reqwest::Method>() {
        Ok(method) => method,
        Err(err) => {
            error!("Unsupported method {}: {err}", method);
            return json_error(StatusCode::BAD_REQUEST, "Unsupported request method");
        }
    };
    let reqwest_headers = convert_request_headers(&upstream_headers);

    let upstream_response = match state
        .client
        .request(reqwest_method, upstream_url)
        .headers(reqwest_headers)
        .body(rewritten_body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(err) => {
            error!("Upstream error: {err}");
            return json_error_with_detail(
                StatusCode::BAD_GATEWAY,
                "Bad gateway",
                &err.to_string(),
            );
        }
    };

    let status = upstream_response.status();
    let response_headers = upstream_response.headers().clone();
    let response_bytes = match upstream_response.bytes().await {
        Ok(bytes) => bytes,
        Err(err) => {
            error!("Failed reading upstream response: {err}");
            return json_error(StatusCode::BAD_GATEWAY, "Failed to read upstream response");
        }
    };

    if state.config.logging.audit {
        tracing::info!(
            target: "audit",
            client = client_name,
            method = %method,
            path = %path,
            status = status.as_u16(),
            "request"
        );
    }

    let mut builder = Response::builder().status(status.as_u16());
    for (name, value) in response_headers.iter() {
        if name.as_str().eq_ignore_ascii_case("transfer-encoding") {
            continue;
        }
        builder = builder.header(name.as_str(), value.as_bytes());
    }

    builder
        .body(Body::from(response_bytes))
        .unwrap_or_else(|_| json_error(StatusCode::BAD_GATEWAY, "Failed to build response"))
}

fn json_error(status: StatusCode, error: &str) -> Response<Body> {
    json_error_value(status, json!({ "error": error }))
}

fn json_error_with_detail(status: StatusCode, error: &str, detail: &str) -> Response<Body> {
    json_error_value(status, json!({ "error": error, "detail": detail }))
}

fn json_error_value(status: StatusCode, payload: Value) -> Response<Body> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(payload.to_string()))
        .expect("json error response should be valid")
}

fn build_verification_payload(config: &Config) -> anyhow::Result<Value> {
    let sample_input = json!({
        "metadata": {
            "user_id": serde_json::to_string(&json!({
                "device_id": "REAL_DEVICE_ID_FROM_CLIENT_abc123",
                "account_uuid": "real-account-uuid",
                "session_id": "real-session-xxx"
            }))?,
        },
        "system": [
            {
                "type": "text",
                "text": "x-anthropic-billing-header: cc_version=2.1.81.a1b; cc_entrypoint=cli;"
            },
            {
                "type": "text",
                "text": "Here is useful information about the environment:\n<env>\nWorking directory: /home/bob/myproject\nPlatform: linux\nShell: bash\nOS Version: Linux 6.5.0-generic\n</env>"
            }
        ],
        "messages": [{ "role": "user", "content": "hello" }]
    });

    let rewritten = serde_json::from_slice::<Value>(&rewrite_request_body(
        &serde_json::to_vec(&sample_input)?,
        "/v1/messages",
        config,
    ))?;

    let rewritten_system_prompt = rewritten["system"]
        .as_array()
        .and_then(|items| items.first())
        .and_then(extract_text)
        .map(|text| text.to_string())
        .unwrap_or_else(|| "(empty)".to_string());

    Ok(json!({
        "_info": "This shows how the gateway rewrites a sample request",
        "before": {
            "metadata.user_id": serde_json::from_str::<Value>(sample_input["metadata"]["user_id"].as_str().unwrap_or("{}"))?,
            "billing_header": sample_input["system"][0]["text"],
            "system_prompt_env": sample_input["system"][1]["text"],
            "system_block_count": sample_input["system"].as_array().map_or(0, Vec::len),
        },
        "after": {
            "metadata.user_id": serde_json::from_str::<Value>(rewritten["metadata"]["user_id"].as_str().unwrap_or("{}"))?,
            "billing_header": "(stripped)",
            "system_prompt_env": rewritten_system_prompt,
            "system_block_count": rewritten["system"].as_array().map_or(0, Vec::len),
        }
    }))
}

fn rewrite_request_body(body: &[u8], path: &str, config: &Config) -> Vec<u8> {
    let Ok(mut parsed) = serde_json::from_slice::<Value>(body) else {
        return body.to_vec();
    };

    if path.starts_with("/v1/messages") {
        rewrite_messages_body(&mut parsed, config);
    } else if path.contains("/event_logging/batch") {
        rewrite_event_batch(&mut parsed, config);
    } else if path.contains("/policy_limits") || path.contains("/settings") {
        rewrite_generic_identity(&mut parsed, &config.identity);
    }

    serde_json::to_vec(&parsed).unwrap_or_else(|_| body.to_vec())
}

fn rewrite_messages_body(body: &mut Value, config: &Config) {
    rewrite_messages_metadata(body, &config.identity);

    if let Some(messages) = body.get_mut("messages").and_then(Value::as_array_mut) {
        for message in messages {
            rewrite_text_container(message.get_mut("content"), |text| {
                rewrite_system_reminders(text, &config.prompt_env)
            });
        }
    }

    if let Some(system) = body.get_mut("system") {
        rewrite_system_body(system, config);
    }
}

fn rewrite_system_body(system: &mut Value, config: &Config) {
    match system {
        Value::Array(items) => {
            items.retain(|item| !system_item_is_billing_only(item));
            for item in items {
                rewrite_text_container(Some(item), |text| {
                    rewrite_prompt_text(&strip_billing_header_block(text), &config.prompt_env)
                });
            }
        }
        Value::String(text) => {
            *text = rewrite_prompt_text(&strip_billing_header_block(text), &config.prompt_env);
        }
        _ => {}
    }
}

fn rewrite_event_batch(body: &mut Value, config: &Config) {
    let Some(events) = body.get_mut("events").and_then(Value::as_array_mut) else {
        return;
    };

    for event in events {
        let Some(event_data) = event.get_mut("event_data") else {
            continue;
        };

        rewrite_event_identity(event_data, &config.identity);
        rewrite_event_env(event_data, config);
        rewrite_event_process(event_data, &config.process);

        if let Some(object) = event_data.as_object_mut() {
            object.remove("baseUrl");
            object.remove("base_url");
            object.remove("gateway");

            if let Some(metadata) = object.get_mut("additional_metadata") {
                rewrite_additional_metadata(metadata, &config.identity);
            }
        }
    }
}

fn rewrite_additional_metadata(value: &mut Value, identity: &ccgw_core::config::IdentityConfig) {
    let Some(encoded) = value.as_str() else {
        return;
    };

    let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(encoded) else {
        return;
    };

    let Ok(mut metadata) = serde_json::from_slice::<Value>(&decoded) else {
        return;
    };

    let Some(object) = metadata.as_object_mut() else {
        return;
    };

    object.remove("baseUrl");
    object.remove("base_url");
    object.remove("gateway");

    if object.contains_key("device_id") {
        object.insert(
            "device_id".to_string(),
            Value::String(identity.device_id.clone()),
        );
    }

    if object.contains_key("email") {
        object.insert("email".to_string(), Value::String(identity.email.clone()));
    }

    if object.contains_key("account_uuid") {
        object.insert(
            "account_uuid".to_string(),
            Value::String(identity.account_uuid.clone()),
        );
    }

    if object.contains_key("session_id") {
        object.insert(
            "session_id".to_string(),
            Value::String(identity.session_id.clone()),
        );
    }

    if let Ok(encoded) = serde_json::to_vec(&metadata)
        .map(|value| base64::engine::general_purpose::STANDARD.encode(value))
    {
        *value = Value::String(encoded);
    }
}

fn rewrite_text_container(target: Option<&mut Value>, mut rewriter: impl FnMut(&str) -> String) {
    let Some(target) = target else {
        return;
    };

    match target {
        Value::String(text) => *text = rewriter(text),
        Value::Array(items) => {
            for item in items {
                if let Some(text) = item
                    .get_mut("text")
                    .and_then(|value| value.as_str())
                    .map(str::to_owned)
                {
                    item["text"] = Value::String(rewriter(&text));
                }
            }
        }
        Value::Object(map) => {
            if let Some(Value::String(text)) = map.get_mut("text") {
                *text = rewriter(text);
            }
        }
        _ => {}
    }
}

fn system_item_is_billing_only(item: &Value) -> bool {
    extract_text(item)
        .map(|text| text.trim_start().starts_with("x-anthropic-billing-header:"))
        .unwrap_or(false)
}

fn strip_billing_header_block(text: &str) -> String {
    text.lines()
        .filter(|line| !line.trim_start().starts_with("x-anthropic-billing-header:"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_text(value: &Value) -> Option<&str> {
    match value {
        Value::String(text) => Some(text),
        Value::Object(map) => map.get("text")?.as_str(),
        _ => None,
    }
}

fn convert_request_headers(headers: &HeaderMap) -> reqwest::header::HeaderMap {
    let mut converted = reqwest::header::HeaderMap::new();

    for (name, value) in headers.iter() {
        let Ok(header_name) = reqwest::header::HeaderName::from_bytes(name.as_str().as_bytes())
        else {
            continue;
        };
        let Ok(header_value) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) else {
            continue;
        };
        converted.append(header_name, header_value);
    }

    converted
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use chrono::{Duration as ChronoDuration, Utc};

    fn test_config() -> Config {
        serde_json::from_value(json!({
            "server": { "port": 8443, "tls": null },
            "upstream": { "url": "http://127.0.0.1:3000" },
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

    fn test_config_with_canonical_profile() -> Config {
        let mut canonical_env_map = std::collections::HashMap::new();
        canonical_env_map.insert("platform".to_string(), json!("linux"));
        canonical_env_map.insert("platform_raw".to_string(), json!("linux"));
        canonical_env_map.insert("arch".to_string(), json!("x64"));
        canonical_env_map.insert("node_version".to_string(), json!("v22.0.0"));
        canonical_env_map.insert("terminal".to_string(), json!("alacritty"));
        canonical_env_map.insert("package_managers".to_string(), json!("npm,yarn,pnpm"));
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

        let mut config = test_config();
        config.canonical_profile = Some(ccgw_core::config::CanonicalProfile {
            version: "1.0".to_string(),
            identity: ccgw_core::config::IdentityConfig {
                device_id: "canonical-device-id".to_string(),
                email: "canonical@example.com".to_string(),
                account_uuid: "canonical-account-uuid".to_string(),
                session_id: "canonical-session-id".to_string(),
            },
            env: canonical_env_map,
            prompt_env: ccgw_core::config::PromptEnvConfig {
                platform: "linux".to_string(),
                shell: "bash".to_string(),
                os_version: "Linux 6.5.0".to_string(),
                working_dir: "/home/deploy/work".to_string(),
            },
            process: ccgw_core::config::ProcessConfig {
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
    fn rewrites_messages_payload() {
        let config = test_config();
        let body = json!({
            "metadata": {
                "user_id": serde_json::to_string(&json!({
                    "device_id": "real-device",
                    "account_uuid": "acct"
                })).unwrap()
            },
            "system": [
                { "type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.81.a1b;" },
                { "type": "text", "text": "Working directory: /home/bob/src\nPlatform: linux\nShell: bash\nOS Version: Linux" }
            ],
            "messages": [{
                "role": "user",
                "content": "<system-reminder>Working directory: /home/bob/src</system-reminder>"
            }]
        });

        let rewritten: Value = serde_json::from_slice(&rewrite_request_body(
            &serde_json::to_vec(&body).unwrap(),
            "/v1/messages",
            &config,
        ))
        .unwrap();

        let metadata: Value =
            serde_json::from_str(rewritten["metadata"]["user_id"].as_str().unwrap()).unwrap();
        assert_eq!(metadata["device_id"], "canonical-device-id");
        assert_eq!(rewritten["system"].as_array().unwrap().len(), 1);
        assert!(rewritten["system"][0]["text"]
            .as_str()
            .unwrap()
            .contains("/Users/canonical/project"));
        assert!(rewritten["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("/Users/canonical/project"));
    }

    #[test]
    fn rewrites_event_batch_payload() {
        let config = test_config();
        let metadata = base64::engine::general_purpose::STANDARD.encode(
            serde_json::to_vec(&json!({
                "baseUrl": "http://local",
                "gateway": "on",
                "keep": true,
                "device_id": "real-device-in-metadata",
                "email": "real-meta@example.com",
                "account_uuid": "real-account-in-metadata",
                "session_id": "real-session-in-metadata"
            }))
            .unwrap(),
        );
        let process = base64::engine::general_purpose::STANDARD.encode(
            serde_json::to_vec(&json!({
                "constrainedMemory": 1,
                "rss": 1,
                "heapTotal": 1,
                "heapUsed": 1
            }))
            .unwrap(),
        );
        let body = json!({
            "events": [{
                "event_data": {
                    "device_id": "real-device",
                    "email": "real@example.com",
                    "account_uuid": "real-account",
                    "session_id": "real-session",
                    "env": { "platform": "linux" },
                    "process": process,
                    "baseUrl": "http://local",
                    "gateway": "on",
                    "additional_metadata": metadata
                }
            }]
        });

        let rewritten: Value = serde_json::from_slice(&rewrite_request_body(
            &serde_json::to_vec(&body).unwrap(),
            "/api/event_logging/batch",
            &config,
        ))
        .unwrap();

        let event_data = &rewritten["events"][0]["event_data"];
        assert_eq!(event_data["device_id"], "canonical-device-id");
        assert_eq!(event_data["email"], "canonical@example.com");
        assert_eq!(event_data["account_uuid"], "canonical-account-uuid");
        assert_eq!(event_data["session_id"], "canonical-session-id");
        assert_eq!(event_data["env"]["platform"], "darwin");
        assert!(event_data.get("baseUrl").is_none());
        assert!(event_data.get("gateway").is_none());

        let decoded_metadata = base64::engine::general_purpose::STANDARD
            .decode(event_data["additional_metadata"].as_str().unwrap())
            .unwrap();
        let decoded_metadata: Value = serde_json::from_slice(&decoded_metadata).unwrap();
        assert!(decoded_metadata.get("baseUrl").is_none());
        assert!(decoded_metadata.get("gateway").is_none());
        assert_eq!(decoded_metadata["keep"], true);
        assert_eq!(decoded_metadata["device_id"], "canonical-device-id");
        assert_eq!(decoded_metadata["email"], "canonical@example.com");
        assert_eq!(decoded_metadata["account_uuid"], "canonical-account-uuid");
        assert_eq!(decoded_metadata["session_id"], "canonical-session-id");

        let decoded_process = base64::engine::general_purpose::STANDARD
            .decode(event_data["process"].as_str().unwrap())
            .unwrap();
        let decoded_process: Value = serde_json::from_slice(&decoded_process).unwrap();
        assert_eq!(decoded_process["constrainedMemory"], 17179869184u64);
    }

    #[test]
    fn rewrites_event_batch_with_canonical_profile_yields_40_plus_env_keys() {
        let config = test_config_with_canonical_profile();
        let body = json!({
            "events": [{
                "event_data": {
                    "device_id": "real-device",
                    "email": "real@example.com",
                    "env": { "platform": "windows", "arch": "x86" }
                }
            }]
        });

        let rewritten: Value = serde_json::from_slice(&rewrite_request_body(
            &serde_json::to_vec(&body).unwrap(),
            "/api/event_logging/batch",
            &config,
        ))
        .unwrap();

        let event_env = &rewritten["events"][0]["event_data"]["env"];
        let env_obj = event_env.as_object().unwrap();
        assert!(
            env_obj.len() >= 40,
            "Canonical profile must yield 40+ env keys in event rewrite, got: {}",
            env_obj.len()
        );
        assert_eq!(event_env["platform"], "linux");
        assert_eq!(event_env["arch"], "x64");
        assert_eq!(event_env["cpu_cores"], 16);
        assert_eq!(event_env["hostname"], "prod-server");
        assert_eq!(event_env["version"], "2.2.0");
    }

    #[test]
    fn rewrites_event_batch_with_legacy_config_yields_21_env_keys() {
        let config = test_config();
        let body = json!({
            "events": [{
                "event_data": {
                    "device_id": "real-device",
                    "email": "real@example.com",
                    "env": { "platform": "windows", "arch": "x86" }
                }
            }]
        });

        let rewritten: Value = serde_json::from_slice(&rewrite_request_body(
            &serde_json::to_vec(&body).unwrap(),
            "/api/event_logging/batch",
            &config,
        ))
        .unwrap();

        let event_env = &rewritten["events"][0]["event_data"]["env"];
        let env_obj = event_env.as_object().unwrap();
        assert_eq!(
            env_obj.len(),
            21,
            "Legacy inline config must yield exactly 21 env keys, got: {}",
            env_obj.len()
        );
        assert_eq!(event_env["platform"], "darwin");
        assert_eq!(event_env["arch"], "arm64");
        assert_eq!(event_env["version"], "2.1.81");
    }
}
