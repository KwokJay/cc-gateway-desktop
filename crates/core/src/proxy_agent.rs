use std::env;

use url::Url;

const PROXY_ENV_KEYS: [&str; 6] = [
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "ALL_PROXY",
    "all_proxy",
];

pub fn get_proxy_url() -> Option<Url> {
    proxy_url_from_iter(PROXY_ENV_KEYS.into_iter().filter_map(|key| {
        env::var(key).ok().and_then(|value| {
            if value.trim().is_empty() {
                None
            } else {
                Some((key, value))
            }
        })
    }))
}

fn proxy_url_from_iter<I>(entries: I) -> Option<Url>
where
    I: IntoIterator<Item = (&'static str, String)>,
{
    entries
        .into_iter()
        .find_map(|(_, value)| Url::parse(value.trim()).ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        ENV_LOCK.get_or_init(|| Mutex::new(()))
    }

    fn clear_proxy_vars() {
        for key in PROXY_ENV_KEYS {
            env::remove_var(key);
        }
    }

    fn set_only(key: &str, value: &str) {
        clear_proxy_vars();
        env::set_var(key, value);
    }

    #[test]
    fn returns_none_when_no_proxy_env_is_set() {
        let _guard = env_lock().lock().unwrap();
        clear_proxy_vars();

        assert_eq!(get_proxy_url(), None);
    }

    #[test]
    fn detects_all_supported_proxy_env_vars_in_priority_order() {
        let _guard = env_lock().lock().unwrap();

        for key in PROXY_ENV_KEYS {
            set_only(key, "http://127.0.0.1:7890");
            assert_eq!(
                get_proxy_url().as_ref().map(Url::as_str),
                Some("http://127.0.0.1:7890/")
            );
        }

        clear_proxy_vars();
    }

    #[test]
    fn skips_invalid_proxy_urls_and_falls_back_to_lower_priority_key() {
        let _guard = env_lock().lock().unwrap();
        clear_proxy_vars();
        env::set_var("HTTPS_PROXY", "not a url");
        env::set_var("HTTP_PROXY", "http://127.0.0.1:8080");

        assert_eq!(
            get_proxy_url().as_ref().map(Url::as_str),
            Some("http://127.0.0.1:8080/")
        );

        clear_proxy_vars();
    }
}
