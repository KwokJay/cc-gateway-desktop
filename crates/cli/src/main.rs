mod config;
mod daemon;
mod install;
mod launcher;
mod shell;

#[cfg(test)]
mod test_support;

#[cfg(test)]
mod tests;

use anyhow::Context;
use clap::{Parser, Subcommand};
use std::process::{Command, Stdio};

use config::CliConfig;
use daemon::check_daemon_health;
use launcher::{launch_claude, prepare_launch_env};

#[derive(Parser)]
#[command(name = "ccg")]
#[command(about = "CC Gateway CLI")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    #[arg(trailing_var_arg = true)]
    args: Vec<String>,
}

#[derive(Subcommand)]
enum Commands {
    Install,
    Uninstall,
    Hijack,
    Release,
    Native {
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
    },
    Status,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Some(Commands::Install) => handle_install(),
        Some(Commands::Uninstall) => handle_uninstall(),
        Some(Commands::Hijack) => handle_hijack(),
        Some(Commands::Release) => handle_release(),
        Some(Commands::Native { args }) => handle_native(&args),
        Some(Commands::Status) => handle_status().await,
        None => handle_launch(&cli.args).await,
    };

    if let Err(e) = result {
        eprintln!("错误: {}", e);
        std::process::exit(1);
    }
}

fn handle_install() -> anyhow::Result<()> {
    install::install()?;
    println!("✓ 已安装为 'ccg' 命令");
    println!();
    println!("  ccg              启动 Claude Code（通过 gateway）");
    println!("  ccg hijack       让 'claude' 也走 gateway");
    println!("  ccg release      恢复 'claude' 为 native");
    println!("  ccg status       查看 gateway 状态");
    Ok(())
}

fn handle_uninstall() -> anyhow::Result<()> {
    let shell = shell::ShellType::detect();
    let rc_path = shell.rc_file()?;

    install::uninstall()?;
    shell::remove_alias(&rc_path)?;

    println!("✓ 已卸载。native 'claude' 已恢复。");
    Ok(())
}

fn handle_hijack() -> anyhow::Result<()> {
    let shell = shell::ShellType::detect();
    let rc_path = shell.rc_file()?;

    if shell::has_alias(&rc_path)? {
        println!("已激活。运行 'ccg release' 撤销。");
        return Ok(());
    }

    shell::add_alias(&rc_path, shell, "claude", "ccg")?;

    println!("✓ 完成。'claude' 现在走 gateway。");
    println!("  新终端: 自动生效。");
    println!("  当前终端: 重开或运行: source {}", rc_path.display());
    println!("  撤销: ccg release");
    Ok(())
}

fn handle_release() -> anyhow::Result<()> {
    let shell = shell::ShellType::detect();
    let rc_path = shell.rc_file()?;

    if !shell::has_alias(&rc_path)? {
        println!("无需撤销 —— 'claude' 已是 native。");
        return Ok(());
    }

    shell::remove_alias(&rc_path)?;
    println!("✓ 完成。'claude' 恢复为 native。");
    Ok(())
}

fn handle_native(args: &[String]) -> anyhow::Result<()> {
    let status = Command::new("claude")
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .context("执行 native claude 失败")?;

    std::process::exit(status.code().unwrap_or(1));
}

pub async fn handle_status() -> anyhow::Result<()> {
    let config = CliConfig::load()?;
    let shell = shell::ShellType::detect();
    let rc_path = shell.rc_file()?;
    let hijack_on = shell::has_alias(&rc_path)?;

    println!("Gateway:  {}", config.gateway_url);
    if hijack_on {
        println!("Hijack:   ON  (claude → gateway)");
    } else {
        println!("Hijack:   OFF (claude = native)");
    }

    match check_daemon_health(&config.health_url()).await {
        Ok(health) => {
            println!("Health:   OK");
            println!("Status:   {}", health.status);
            println!("OAuth:    {}", health.oauth);
            println!("Device:   {}", health.canonical_device);
            Ok(())
        }
        Err(e) => {
            println!("Health:   UNREACHABLE");
            eprintln!("Warning: {}", e);
            anyhow::bail!("Gateway 连接失败")
        }
    }
}

pub async fn handle_launch(args: &[String]) -> anyhow::Result<()> {
    let config = CliConfig::load()?;

    prepare_launch_env(&config.gateway_url, &config.client_token);

    launch_claude(args)?;

    Ok(())
}
