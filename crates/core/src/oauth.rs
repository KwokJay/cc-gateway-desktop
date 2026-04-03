use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Duration as ChronoDuration, TimeZone, Utc};
use reqwest::Client;
use tokio::task::JoinHandle;
use url::Url;

use crate::config::OAuthConfig;
use crate::proxy_agent::get_proxy_url;

pub const TOKEN_URL: &str = "https://platform.claude.com/v1/oauth/token";
pub const CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
pub const SCOPES: &str =
    "user:inference user:profile user:sessions:claude_code user:mcp_servers user:file_upload";

const MIN_REFRESH_DELAY: Duration = Duration::from_secs(10);
const RETRY_DELAY: Duration = Duration::from_secs(30);

#[derive(Debug)]
struct OAuthState {
    access_token: Option<String>,
    refresh_token: String,
    expires_at: Option<DateTime<Utc>>,
    refresh_task: Option<JoinHandle<()>>,
}

#[derive(Clone)]
pub struct OAuthManager {
    client: Client,
    token_url: Url,
    state: Arc<Mutex<OAuthState>>,
}

impl OAuthManager {
    pub fn new(
        access_token: Option<String>,
        refresh_token: String,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<Self> {
        Self::with_token_url(
            access_token,
            refresh_token,
            expires_at,
            Url::parse(TOKEN_URL)?,
        )
    }

    pub fn from_config(config: &OAuthConfig) -> Result<Self> {
        let expires_at = config
            .expires_at
            .and_then(|timestamp| Utc.timestamp_millis_opt(timestamp).single());

        Self::new(
            config.access_token.clone(),
            config.refresh_token.clone(),
            expires_at,
        )
    }

    pub fn with_token_url(
        access_token: Option<String>,
        refresh_token: String,
        expires_at: Option<DateTime<Utc>>,
        token_url: Url,
    ) -> Result<Self> {
        Ok(Self::with_client(
            access_token,
            refresh_token,
            expires_at,
            token_url,
            build_client()?,
        ))
    }

    pub fn with_client(
        access_token: Option<String>,
        refresh_token: String,
        expires_at: Option<DateTime<Utc>>,
        token_url: Url,
        client: Client,
    ) -> Self {
        Self {
            client,
            token_url,
            state: Arc::new(Mutex::new(OAuthState {
                access_token,
                refresh_token,
                expires_at,
                refresh_task: None,
            })),
        }
    }

    pub async fn init(&self) -> Result<()> {
        let now = Utc::now();
        let existing_expiry = self.state.lock().unwrap().expires_at;

        if existing_expiry
            .map(|expires_at| self.get_access_token().is_some() && token_is_valid(expires_at, now))
            .unwrap_or(false)
        {
            self.schedule_refresh();
            return Ok(());
        }

        self.refresh_token().await?;
        self.schedule_refresh();
        Ok(())
    }

    pub fn get_access_token(&self) -> Option<String> {
        let state = self.state.lock().unwrap();
        let expires_at = state.expires_at?;

        if Utc::now() >= expires_at {
            return None;
        }

        state.access_token.clone()
    }

    pub async fn refresh_token(&self) -> Result<()> {
        refresh_tokens(&self.client, self.token_url.clone(), &self.state).await
    }

    pub fn schedule_refresh(&self) {
        let expires_at = self.state.lock().unwrap().expires_at;
        let Some(expires_at) = expires_at else {
            return;
        };

        let delay = refresh_delay(Utc::now(), expires_at);
        let state = Arc::downgrade(&self.state);
        let client = self.client.clone();
        let token_url = self.token_url.clone();

        let handle = tokio::spawn(async move {
            refresh_loop(state, client, token_url, delay).await;
        });

        let mut locked = self.state.lock().unwrap();
        if let Some(existing) = locked.refresh_task.take() {
            existing.abort();
        }
        locked.refresh_task = Some(handle);
    }
}

impl Drop for OAuthManager {
    fn drop(&mut self) {
        if Arc::strong_count(&self.state) != 1 {
            return;
        }

        if let Ok(mut state) = self.state.lock() {
            if let Some(handle) = state.refresh_task.take() {
                handle.abort();
            }
        }
    }
}

fn build_client() -> Result<Client> {
    let mut builder = Client::builder();

    if let Some(proxy_url) = get_proxy_url() {
        builder = builder.proxy(reqwest::Proxy::all(proxy_url.as_str())?);
    }

    Ok(builder.build()?)
}

async fn refresh_loop(
    state: Weak<Mutex<OAuthState>>,
    client: Client,
    token_url: Url,
    delay: Duration,
) {
    let mut next_delay = delay;

    loop {
        tokio::time::sleep(next_delay).await;

        let Some(state) = state.upgrade() else {
            break;
        };

        match refresh_tokens(&client, token_url.clone(), &state).await {
            Ok(()) => {
                let expires_at = state.lock().unwrap().expires_at;
                let Some(expires_at) = expires_at else {
                    break;
                };
                next_delay = refresh_delay(Utc::now(), expires_at);
            }
            Err(_) => {
                next_delay = RETRY_DELAY;
            }
        }
    }
}

async fn refresh_tokens(
    client: &Client,
    token_url: Url,
    state: &Arc<Mutex<OAuthState>>,
) -> Result<()> {
    let refresh_token = state.lock().unwrap().refresh_token.clone();
    let response = client
        .post(token_url)
        .json(&serde_json::json!({
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": CLIENT_ID,
            "scope": SCOPES,
        }))
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;

    if !status.is_success() {
        return Err(anyhow!("OAuth refresh failed ({status}): {body}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body)?;
    let access_token = parsed
        .get("access_token")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow!("OAuth refresh response missing access_token"))?
        .to_string();
    let rotated_refresh_token = parsed
        .get("refresh_token")
        .and_then(serde_json::Value::as_str)
        .map(ToOwned::to_owned);
    let expires_in = parsed
        .get("expires_in")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(3600);

    let mut locked = state.lock().unwrap();
    locked.access_token = Some(access_token);
    locked.refresh_token = rotated_refresh_token.unwrap_or(refresh_token);
    locked.expires_at = Some(Utc::now() + ChronoDuration::seconds(expires_in));

    Ok(())
}

fn token_is_valid(expires_at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    expires_at > now
}

fn refresh_delay(now: DateTime<Utc>, expires_at: DateTime<Utc>) -> Duration {
    let ms_until_expiry = expires_at
        .signed_duration_since(now)
        .num_milliseconds()
        .max(0) as u64;
    Duration::from_millis(ms_until_expiry).max(MIN_REFRESH_DELAY)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    use serde_json::{json, Value};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[derive(Clone)]
    struct MockResponse {
        status_code: u16,
        body: String,
    }

    #[derive(Debug, Clone)]
    struct CapturedRequest {
        body: String,
    }

    #[test]
    fn init_uses_existing_valid_access_token() {
        tokio_test::block_on(async {
            let manager = OAuthManager::with_client(
                Some("existing-access".to_string()),
                "refresh-123".to_string(),
                Some(Utc::now() + ChronoDuration::minutes(10)),
                Url::parse("http://127.0.0.1:9/v1/oauth/token").unwrap(),
                Client::new(),
            );

            manager.init().await.unwrap();

            assert_eq!(
                manager.get_access_token(),
                Some("existing-access".to_string())
            );
        });
    }

    #[test]
    fn init_refreshes_missing_token_via_http() {
        tokio_test::block_on(async {
            let (token_url, requests, _server) = spawn_mock_server(vec![MockResponse {
                status_code: 200,
                body: json!({
                    "access_token": "fresh-access",
                    "refresh_token": "rotated-refresh",
                    "expires_in": 3600
                })
                .to_string(),
            }])
            .await;

            let manager = OAuthManager::with_client(
                None,
                "refresh-123".to_string(),
                None,
                token_url,
                Client::new(),
            );

            manager.init().await.unwrap();

            assert_eq!(manager.get_access_token(), Some("fresh-access".to_string()));

            let requests = requests.lock().unwrap();
            assert_eq!(requests.len(), 1);

            let body: Value = serde_json::from_str(&requests[0].body).unwrap();
            assert_eq!(body["grant_type"], "refresh_token");
            assert_eq!(body["refresh_token"], "refresh-123");
            assert_eq!(body["client_id"], CLIENT_ID);
            assert_eq!(body["scope"], SCOPES);
        });
    }

    #[test]
    fn refresh_token_preserves_existing_refresh_token_when_not_rotated() {
        tokio_test::block_on(async {
            let (token_url, _requests, _server) = spawn_mock_server(vec![MockResponse {
                status_code: 200,
                body: json!({
                    "access_token": "fresh-access",
                    "expires_in": 3600
                })
                .to_string(),
            }])
            .await;

            let manager = OAuthManager::with_client(
                None,
                "refresh-123".to_string(),
                None,
                token_url,
                Client::new(),
            );

            manager.refresh_token().await.unwrap();

            let state = manager.state.lock().unwrap();
            assert_eq!(state.access_token.as_deref(), Some("fresh-access"));
            assert_eq!(state.refresh_token, "refresh-123");
            assert!(state.expires_at.is_some());
        });
    }

    #[test]
    fn aggressive_exact_expiry_semantics() {
        let now = Utc::now();

        // Token is valid up to exact expiry
        assert!(token_is_valid(now + ChronoDuration::seconds(1), now));
        assert!(!token_is_valid(now, now));
        assert!(!token_is_valid(now - ChronoDuration::seconds(1), now));

        // Refresh is scheduled at exact expiry
        assert_eq!(
            refresh_delay(now, now + ChronoDuration::minutes(10)),
            Duration::from_secs(600)
        );

        // MIN_REFRESH_DELAY is honored when expiry is too close
        assert_eq!(
            refresh_delay(now, now + ChronoDuration::seconds(5)),
            MIN_REFRESH_DELAY
        );
    }

    #[test]
    fn schedule_refresh_registers_background_task() {
        tokio_test::block_on(async {
            let manager = OAuthManager::with_client(
                Some("existing-access".to_string()),
                "refresh-123".to_string(),
                Some(Utc::now() + ChronoDuration::minutes(6)),
                Url::parse("http://127.0.0.1:9/v1/oauth/token").unwrap(),
                Client::new(),
            );

            manager.schedule_refresh();

            let state = manager.state.lock().unwrap();
            assert!(state.refresh_task.is_some());
        });
    }

    #[test]
    fn init_does_not_refresh_when_token_valid_until_exact_expiry() {
        tokio_test::block_on(async {
            let (token_url, requests, _server) = spawn_mock_server(vec![]).await;

            // Token expires in 1 second - still valid right now
            let manager = OAuthManager::with_client(
                Some("existing-access".to_string()),
                "refresh-123".to_string(),
                Some(Utc::now() + ChronoDuration::seconds(1)),
                token_url,
                Client::new(),
            );

            manager.init().await.unwrap();

            // Zero network calls - aggressive mode reuses existing token
            let requests = requests.lock().unwrap();
            assert_eq!(requests.len(), 0);
            assert_eq!(
                manager.get_access_token(),
                Some("existing-access".to_string())
            );
        });
    }

    #[test]
    fn get_access_token_returns_none_when_expired() {
        let manager = OAuthManager::with_client(
            Some("expired-token".to_string()),
            "refresh-123".to_string(),
            Some(Utc::now() - ChronoDuration::seconds(1)),
            Url::parse("http://127.0.0.1:9/v1/oauth/token").unwrap(),
            Client::new(),
        );

        assert_eq!(manager.get_access_token(), None);
    }

    async fn spawn_mock_server(
        responses: Vec<MockResponse>,
    ) -> (Url, Arc<Mutex<Vec<CapturedRequest>>>, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let captured_requests = Arc::new(Mutex::new(Vec::new()));
        let captured_requests_handle = Arc::clone(&captured_requests);

        let server = tokio::spawn(async move {
            for response in responses {
                let (mut stream, _) = listener.accept().await.unwrap();
                let request = read_request(&mut stream).await;
                captured_requests_handle.lock().unwrap().push(request);

                let body = response.body;
                let response_text = format!(
                    "HTTP/1.1 {} {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    response.status_code,
                    reason_phrase(response.status_code),
                    body.len(),
                    body,
                );

                stream.write_all(response_text.as_bytes()).await.unwrap();
            }
        });

        (
            Url::parse(&format!("http://{address}/v1/oauth/token")).unwrap(),
            captured_requests,
            server,
        )
    }

    async fn read_request(stream: &mut tokio::net::TcpStream) -> CapturedRequest {
        let mut buffer = Vec::new();
        let mut chunk = [0; 1024];

        loop {
            let read = stream.read(&mut chunk).await.unwrap();
            if read == 0 {
                break;
            }

            buffer.extend_from_slice(&chunk[..read]);
            if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
                break;
            }
        }

        let header_end = buffer
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .map(|index| index + 4)
            .unwrap();
        let headers = String::from_utf8_lossy(&buffer[..header_end]).to_string();
        let content_length = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().ok())
                    .flatten()
            })
            .unwrap_or(0);

        while buffer.len() < header_end + content_length {
            let read = stream.read(&mut chunk).await.unwrap();
            if read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..read]);
        }

        let body =
            String::from_utf8_lossy(&buffer[header_end..header_end + content_length]).to_string();
        CapturedRequest { body }
    }

    fn reason_phrase(status_code: u16) -> &'static str {
        match status_code {
            200 => "OK",
            400 => "Bad Request",
            401 => "Unauthorized",
            500 => "Internal Server Error",
            _ => "OK",
        }
    }
}
