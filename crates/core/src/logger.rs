use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn init_logger(level: &str, _audit: bool) {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(level));

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();

    info!("Logger initialized with level: {}", level);
}

pub fn audit(client: &str, method: &str, path: &str, status: u16) {
    info!(
        target: "audit",
        client = %client,
        method = %method,
        path = %path,
        status = %status,
        "request"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_log() {
        audit("test-client", "GET", "/health", 200);
    }
}
