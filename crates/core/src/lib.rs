pub mod auth;
pub mod config;
pub mod logger;
pub mod oauth;
pub mod proxy_agent;
pub mod rewriter;

pub use auth::{AuthManager, TokenEntry};
pub use config::Config;
pub use logger::init_logger;
pub use oauth::{OAuthManager, CLIENT_ID, SCOPES, TOKEN_URL};
pub use proxy_agent::get_proxy_url;
pub use rewriter::env::{
    build_canonical_env_from_config, build_canonical_env_from_env_config, build_canonical_process,
    rewrite_event_env, rewrite_event_process,
};
pub use rewriter::headers::rewrite_headers;
pub use rewriter::identity::{
    rewrite_event_identity, rewrite_generic_identity, rewrite_messages_metadata,
};
pub use rewriter::prompt::{
    compute_cch, rewrite_prompt_text, rewrite_system_reminders, strip_billing_header,
};
