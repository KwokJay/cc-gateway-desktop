use std::collections::HashMap;

use http::HeaderMap;

pub use crate::config::TokenEntry;

#[derive(Debug, Clone, Default)]
pub struct AuthManager {
    tokens: HashMap<String, String>,
}

impl AuthManager {
    pub fn new(tokens: impl IntoIterator<Item = TokenEntry>) -> Self {
        let mut manager = Self::default();
        for token in tokens {
            manager.add_token(token);
        }
        manager
    }

    pub fn add_token(&mut self, entry: TokenEntry) {
        self.tokens.insert(entry.token, entry.name);
    }

    pub fn authenticate(&self, headers: &HeaderMap) -> Option<String> {
        self.authenticate_api_key(headers)
            .or_else(|| self.authenticate_bearer_with_typescript_precedence(headers))
    }

    fn authenticate_bearer_with_typescript_precedence(
        &self,
        headers: &HeaderMap,
    ) -> Option<String> {
        let header_name = if headers.contains_key("proxy-authorization") {
            "proxy-authorization"
        } else {
            "authorization"
        };

        self.authenticate_bearer(headers, header_name)
    }

    fn authenticate_api_key(&self, headers: &HeaderMap) -> Option<String> {
        let token = header_value(headers, "x-api-key")?;
        self.tokens.get(token).cloned()
    }

    fn authenticate_bearer(&self, headers: &HeaderMap, header_name: &str) -> Option<String> {
        let value = header_value(headers, header_name)?;
        let token = extract_bearer_token(value)?;
        self.tokens.get(token).cloned()
    }
}

fn header_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name)?.to_str().ok()
}

fn extract_bearer_token(value: &str) -> Option<&str> {
    let mut parts = value.split_whitespace();
    let scheme = parts.next()?;
    let token = parts.next()?;

    if !scheme.eq_ignore_ascii_case("bearer") || parts.next().is_some() {
        return None;
    }

    Some(token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::{HeaderMap, HeaderValue};

    fn build_auth_manager() -> AuthManager {
        AuthManager::new(vec![
            TokenEntry {
                name: "alice".to_string(),
                token: "token123".to_string(),
            },
            TokenEntry {
                name: "bob".to_string(),
                token: "token456".to_string(),
            },
        ])
    }

    #[test]
    fn authenticates_x_api_key_header() {
        let auth = build_auth_manager();
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("token123"));

        assert_eq!(auth.authenticate(&headers), Some("alice".to_string()));
    }

    #[test]
    fn authenticates_authorization_bearer_header() {
        let auth = build_auth_manager();
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer token456"));

        assert_eq!(auth.authenticate(&headers), Some("bob".to_string()));
    }

    #[test]
    fn authenticates_proxy_authorization_before_authorization() {
        let auth = build_auth_manager();
        let mut headers = HeaderMap::new();
        headers.insert(
            "proxy-authorization",
            HeaderValue::from_static("Bearer token123"),
        );
        headers.insert("authorization", HeaderValue::from_static("Bearer token456"));

        assert_eq!(auth.authenticate(&headers), Some("alice".to_string()));
    }

    #[test]
    fn falls_back_to_bearer_when_api_key_is_invalid() {
        let auth = build_auth_manager();
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("invalid"));
        headers.insert("authorization", HeaderValue::from_static("Bearer token456"));

        assert_eq!(auth.authenticate(&headers), Some("bob".to_string()));
    }

    #[test]
    fn does_not_fallback_when_proxy_authorization_is_invalid() {
        let auth = build_auth_manager();
        let mut headers = HeaderMap::new();
        headers.insert(
            "proxy-authorization",
            HeaderValue::from_static("Bearer invalid-token"),
        );
        headers.insert("authorization", HeaderValue::from_static("Bearer token456"));

        assert_eq!(auth.authenticate(&headers), None);
    }

    #[test]
    fn returns_none_for_invalid_or_malformed_tokens() {
        let auth = build_auth_manager();

        let mut invalid_token = HeaderMap::new();
        invalid_token.insert("x-api-key", HeaderValue::from_static("invalid"));
        assert_eq!(auth.authenticate(&invalid_token), None);

        let mut malformed_bearer = HeaderMap::new();
        malformed_bearer.insert("authorization", HeaderValue::from_static("Basic token123"));
        assert_eq!(auth.authenticate(&malformed_bearer), None);
    }
}
