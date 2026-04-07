use http::header::{HeaderName, HeaderValue, USER_AGENT};
use http::HeaderMap;

const STRIPPED_HEADERS: [&str; 8] = [
    "host",
    "connection",
    "proxy-authorization",
    "proxy-connection",
    "transfer-encoding",
    "authorization",
    "x-api-key",
    "x-anthropic-billing-header",
];

pub fn rewrite_headers(headers: &HeaderMap, version: &str) -> HeaderMap {
    let mut rewritten = HeaderMap::new();
    let canonical_user_agent =
        HeaderValue::from_str(&format!("claude-code/{version} (external, cli)"))
            .expect("canonical user-agent should be valid");

    for (name, value) in headers {
        if STRIPPED_HEADERS.contains(&name.as_str()) {
            continue;
        }

        if name == USER_AGENT {
            rewritten.insert(USER_AGENT, canonical_user_agent.clone());
        } else {
            join_or_append_header(&mut rewritten, name, value);
        }
    }

    rewritten
}

fn join_or_append_header(headers: &mut HeaderMap, name: &HeaderName, value: &HeaderValue) {
    if let Some(existing) = headers.get(name) {
        let mut joined = existing.as_bytes().to_vec();
        joined.extend_from_slice(b", ");
        joined.extend_from_slice(value.as_bytes());

        let joined_value =
            HeaderValue::from_bytes(&joined).expect("combined header value should be valid");
        headers.insert(name, joined_value);
    } else {
        headers.append(name, value.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::HeaderValue;

    #[test]
    fn rewrites_user_agent_to_canonical_version() {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("claude-code/2.0.50 (external, cli)"),
        );
        headers.insert("x-app", HeaderValue::from_static("cli"));

        let rewritten = rewrite_headers(&headers, "2.1.81");

        assert_eq!(
            rewritten.get(USER_AGENT).unwrap(),
            &HeaderValue::from_static("claude-code/2.1.81 (external, cli)")
        );
        assert_eq!(rewritten.get("x-app").unwrap(), "cli");
    }

    #[test]
    fn strips_all_blocked_headers() {
        let mut headers = HeaderMap::new();
        for header in STRIPPED_HEADERS {
            headers.insert(header, HeaderValue::from_static("blocked"));
        }
        headers.insert("x-app", HeaderValue::from_static("cli"));

        let rewritten = rewrite_headers(&headers, "2.1.81");

        for header in STRIPPED_HEADERS {
            assert!(
                rewritten.get(header).is_none(),
                "{header} should be removed"
            );
        }
        assert_eq!(rewritten.get("x-app").unwrap(), "cli");
    }

    #[test]
    fn preserves_non_rewritten_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("accept", HeaderValue::from_static("application/json"));
        headers.insert("x-request-id", HeaderValue::from_static("abc-123"));

        let rewritten = rewrite_headers(&headers, "2.1.81");

        assert_eq!(rewritten.get("accept").unwrap(), "application/json");
        assert_eq!(rewritten.get("x-request-id").unwrap(), "abc-123");
    }

    #[test]
    fn coalesces_duplicate_header_values_to_match_ts_behavior() {
        let mut headers = HeaderMap::new();
        headers.append("x-forwarded-for", HeaderValue::from_static("198.51.100.1"));
        headers.append("x-forwarded-for", HeaderValue::from_static("198.51.100.2"));

        let rewritten = rewrite_headers(&headers, "2.1.81");

        assert_eq!(
            rewritten.get("x-forwarded-for").unwrap(),
            "198.51.100.1, 198.51.100.2"
        );
        assert_eq!(rewritten.get_all("x-forwarded-for").iter().count(), 1);
    }
}
