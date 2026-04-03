use anyhow::{Context, Result};
use std::env;
use std::process::Command;

/// 准备启动环境变量
pub fn prepare_launch_env(gateway_url: &str, client_token: &str) {
    env::set_var("ANTHROPIC_BASE_URL", gateway_url);
    env::set_var("ANTHROPIC_API_KEY", client_token);
    env::set_var("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1");
    env::set_var("CLAUDE_CODE_ATTRIBUTION_HEADER", "false");
}

/// 启动 claude 命令并透传参数
pub fn launch_claude(args: &[String]) -> Result<()> {
    let claude_path =
        which_claude().context("Failed to locate claude command. Is Claude Code installed?")?;

    let status = Command::new(claude_path)
        .args(args)
        .status()
        .context("Failed to execute claude command")?;

    if !status.success() {
        return Err(anyhow::anyhow!(
            "claude command exited with code: {:?}",
            status.code()
        ));
    }

    Ok(())
}

fn which_claude() -> Result<String> {
    let output = Command::new("which")
        .arg("claude")
        .output()
        .context("Failed to run 'which claude'")?;

    if !output.status.success() {
        return Err(anyhow::anyhow!("claude command not found in PATH"));
    }

    let path = String::from_utf8(output.stdout)
        .context("Invalid UTF-8 in which output")?
        .trim()
        .to_string();

    if path.is_empty() {
        return Err(anyhow::anyhow!("claude command not found"));
    }

    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::env_lock;

    #[test]
    fn test_prepare_launch_env() {
        let _guard = env_lock();
        prepare_launch_env("http://localhost:8443", "test-token");

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
    }

    #[test]
    fn test_which_claude_not_found() {
        let result = which_claude();
        if result.is_err() {
            assert!(result.unwrap_err().to_string().contains("not found"));
        }
    }
}
