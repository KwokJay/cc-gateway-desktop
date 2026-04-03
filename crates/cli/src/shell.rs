use anyhow::{Context, Result};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// Shell 类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellType {
    Zsh,
    Bash,
    Fish,
    Unknown,
}

impl ShellType {
    /// 从 SHELL 环境变量检测当前 shell
    pub fn detect() -> Self {
        env::var("SHELL")
            .ok()
            .and_then(|shell| {
                if shell.ends_with("/zsh") {
                    Some(ShellType::Zsh)
                } else if shell.ends_with("/bash") {
                    Some(ShellType::Bash)
                } else if shell.ends_with("/fish") {
                    Some(ShellType::Fish)
                } else {
                    None
                }
            })
            .unwrap_or(ShellType::Unknown)
    }

    /// 获取对应的 RC 文件路径
    pub fn rc_file(&self) -> Result<PathBuf> {
        let home = dirs::home_dir().context("无法获取 home 目录")?;

        let path = match self {
            ShellType::Zsh => {
                let zdotdir =
                    env::var("ZDOTDIR").unwrap_or_else(|_| home.to_string_lossy().into_owned());
                PathBuf::from(zdotdir).join(".zshrc")
            }
            ShellType::Bash => home.join(".bashrc"),
            ShellType::Fish => {
                let xdg_config = env::var("XDG_CONFIG_HOME")
                    .unwrap_or_else(|_| home.join(".config").to_string_lossy().into_owned());
                PathBuf::from(xdg_config).join("fish/config.fish")
            }
            ShellType::Unknown => home.join(".profile"),
        };

        Ok(path)
    }

    /// 生成 alias 语法（不同 shell 格式不同）
    pub fn format_alias(&self, alias_name: &str, target: &str) -> String {
        match self {
            ShellType::Fish => format!("alias {} '{}' # cc-gateway alias", alias_name, target),
            _ => format!("alias {}='{}' # cc-gateway alias", alias_name, target),
        }
    }
}

const ALIAS_TAG: &str = "# cc-gateway alias";

/// 检查 RC 文件中是否已存在 alias
pub fn has_alias(rc_path: &Path) -> Result<bool> {
    if !rc_path.exists() {
        return Ok(false);
    }
    let content = fs::read_to_string(rc_path)?;
    Ok(content.contains(ALIAS_TAG))
}

/// 向 RC 文件添加 alias（幂等）
pub fn add_alias(rc_path: &Path, shell: ShellType, alias_name: &str, target: &str) -> Result<()> {
    // 确保父目录存在
    if let Some(parent) = rc_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // 已存在则跳过
    if has_alias(rc_path)? {
        return Ok(());
    }

    let alias_line = shell.format_alias(alias_name, target);
    let mut content = if rc_path.exists() {
        fs::read_to_string(rc_path)?
    } else {
        String::new()
    };

    // 确保末尾有换行
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }

    content.push_str(&alias_line);
    content.push('\n');

    fs::write(rc_path, content)?;
    Ok(())
}

/// 从 RC 文件移除 alias（幂等）
pub fn remove_alias(rc_path: &Path) -> Result<()> {
    if !rc_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(rc_path)?;
    if !content.contains(ALIAS_TAG) {
        return Ok(());
    }

    let cleaned: String = content
        .lines()
        .filter(|line| !line.contains(ALIAS_TAG))
        .collect::<Vec<_>>()
        .join("\n");

    // 保留末尾换行
    let final_content = if cleaned.is_empty() {
        String::new()
    } else {
        format!("{}\n", cleaned)
    };

    fs::write(rc_path, final_content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_shell_type_format_alias() {
        assert_eq!(
            ShellType::Zsh.format_alias("claude", "ccg"),
            "alias claude='ccg' # cc-gateway alias"
        );
        assert_eq!(
            ShellType::Bash.format_alias("claude", "ccg"),
            "alias claude='ccg' # cc-gateway alias"
        );
        assert_eq!(
            ShellType::Fish.format_alias("claude", "ccg"),
            "alias claude 'ccg' # cc-gateway alias"
        );
    }

    #[test]
    fn test_has_alias_empty_file() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, "export PATH=/usr/local/bin:$PATH").unwrap();

        assert!(!has_alias(tmp.path()).unwrap());
    }

    #[test]
    fn test_has_alias_present() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, "export PATH=/usr/local/bin:$PATH").unwrap();
        writeln!(tmp, "alias claude='ccg' # cc-gateway alias").unwrap();

        assert!(has_alias(tmp.path()).unwrap());
    }

    #[test]
    fn test_add_alias_idempotent() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        // 第一次添加
        add_alias(path, ShellType::Zsh, "claude", "ccg").unwrap();
        let content1 = fs::read_to_string(path).unwrap();
        assert!(content1.contains("alias claude='ccg' # cc-gateway alias"));
        let count1 = content1.matches(ALIAS_TAG).count();

        // 第二次添加应该幂等
        add_alias(path, ShellType::Zsh, "claude", "ccg").unwrap();
        let content2 = fs::read_to_string(path).unwrap();
        assert_eq!(content1, content2);
        assert_eq!(content2.matches(ALIAS_TAG).count(), count1);
    }

    #[test]
    fn test_remove_alias() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        // 添加 alias
        add_alias(path, ShellType::Bash, "claude", "ccg").unwrap();
        assert!(has_alias(path).unwrap());

        // 移除
        remove_alias(path).unwrap();
        assert!(!has_alias(path).unwrap());

        // 再次移除应该幂等
        remove_alias(path).unwrap();
        assert!(!has_alias(path).unwrap());
    }

    #[test]
    fn test_remove_alias_preserves_other_content() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, "export PATH=/usr/local/bin:$PATH").unwrap();
        writeln!(tmp, "alias ll='ls -la'").unwrap();
        tmp.flush().unwrap();

        let path = tmp.path();
        add_alias(path, ShellType::Zsh, "claude", "ccg").unwrap();

        let before = fs::read_to_string(path).unwrap();
        assert!(before.contains("export PATH"));
        assert!(before.contains("alias ll"));
        assert!(before.contains(ALIAS_TAG));

        remove_alias(path).unwrap();

        let after = fs::read_to_string(path).unwrap();
        assert!(after.contains("export PATH"));
        assert!(after.contains("alias ll"));
        assert!(!after.contains(ALIAS_TAG));
    }
}
