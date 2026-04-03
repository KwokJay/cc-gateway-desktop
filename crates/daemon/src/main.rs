use ccgw_core::{init_logger, Config};
use ccgw_daemon::run;
use std::path::Path;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config_path = std::env::args()
        .nth(1)
        .map(|s| std::path::PathBuf::from(s))
        .unwrap_or_else(|| Path::new("config.yaml").to_path_buf());

    let config = match Config::load(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to load config: {}", e);
            std::process::exit(1);
        }
    };

    init_logger(&config.logging.level, config.logging.audit);
    info!("CC Gateway Daemon starting on port {}", config.server.port);
    run(config).await
}
