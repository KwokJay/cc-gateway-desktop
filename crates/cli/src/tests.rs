use super::{handle_launch, handle_status};
use crate::test_support::env_lock;
use std::env;

fn cleanup_env() {
    env::remove_var("CCG_CONFIG_PATH");
    env::remove_var("CCG_GATEWAY_URL");
    env::remove_var("CCG_CLIENT_TOKEN");
    env::remove_var("ANTHROPIC_BASE_URL");
    env::remove_var("ANTHROPIC_API_KEY");
    env::remove_var("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC");
    env::remove_var("CLAUDE_CODE_ATTRIBUTION_HEADER");
}

#[tokio::test]
async fn test_handle_status_unreachable() {
    let _guard = env_lock();
    cleanup_env();
    env::set_var("CCG_GATEWAY_URL", "http://localhost:1");
    env::set_var("CCG_CLIENT_TOKEN", "test-token");

    let result = handle_status().await;

    assert!(result.is_err());

    cleanup_env();
}

#[tokio::test]
async fn test_handle_launch_missing_config() {
    let _guard = env_lock();
    cleanup_env();

    let result = handle_launch(&[]).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_handle_launch_prepares_env() {
    let _guard = env_lock();
    cleanup_env();
    env::set_var("CCG_GATEWAY_URL", "http://localhost:8443");
    env::set_var("CCG_CLIENT_TOKEN", "test-token");

    let args: Vec<String> = vec![];
    let _result = handle_launch(&args).await;

    assert_eq!(
        env::var("ANTHROPIC_BASE_URL").unwrap(),
        "http://localhost:8443"
    );
    assert_eq!(env::var("ANTHROPIC_API_KEY").unwrap(), "test-token");
    assert_eq!(
        env::var("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC").unwrap(),
        "1"
    );
    assert_eq!(env::var("CLAUDE_CODE_ATTRIBUTION_HEADER").unwrap(), "false");

    cleanup_env();
}
