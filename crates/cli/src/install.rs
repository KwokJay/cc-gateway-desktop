use anyhow::{Context, Result};
use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

const INSTALL_PATH: &str = "/usr/local/bin/ccg";

pub fn get_current_binary_path() -> Result<PathBuf> {
    env::current_exe().context("无法获取当前二进制路径")
}

pub fn install_binary(source: &Path, target: &Path) -> Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::copy(source, target).with_context(|| format!("复制 {:?} 到 {:?} 失败", source, target))?;

    #[cfg(unix)]
    {
        let mut perms = fs::metadata(target)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(target, perms)?;
    }

    Ok(())
}

pub fn uninstall_binary(target: &Path) -> Result<()> {
    if target.exists() {
        fs::remove_file(target).with_context(|| format!("删除 {:?} 失败", target))?;
    }
    Ok(())
}

pub fn install() -> Result<()> {
    let source = get_current_binary_path()?;
    let target = Path::new(INSTALL_PATH);
    install_binary(&source, target)
}

pub fn uninstall() -> Result<()> {
    let target = Path::new(INSTALL_PATH);
    uninstall_binary(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::TempDir;

    #[test]
    fn test_install_binary_creates_target() {
        let tmp_dir = TempDir::new().unwrap();
        let source = tmp_dir.path().join("source");
        let target = tmp_dir.path().join("bin").join("ccg");

        File::create(&source).unwrap();

        install_binary(&source, &target).unwrap();

        assert!(target.exists());
    }

    #[test]
    fn test_install_binary_sets_executable() {
        let tmp_dir = TempDir::new().unwrap();
        let source = tmp_dir.path().join("source");
        let target = tmp_dir.path().join("ccg");

        File::create(&source).unwrap();
        install_binary(&source, &target).unwrap();

        let metadata = fs::metadata(&target).unwrap();
        let perms = metadata.permissions();
        assert_eq!(perms.mode() & 0o755, 0o755);
    }

    #[test]
    fn test_install_binary_idempotent() {
        let tmp_dir = TempDir::new().unwrap();
        let source = tmp_dir.path().join("source");
        let target = tmp_dir.path().join("ccg");

        File::create(&source).unwrap();
        fs::write(&source, b"content").unwrap();

        install_binary(&source, &target).unwrap();
        let first_metadata = fs::metadata(&target).unwrap();

        install_binary(&source, &target).unwrap();
        let second_metadata = fs::metadata(&target).unwrap();

        assert_eq!(first_metadata.len(), second_metadata.len());
    }

    #[test]
    fn test_uninstall_binary_removes_file() {
        let tmp_dir = TempDir::new().unwrap();
        let target = tmp_dir.path().join("ccg");

        File::create(&target).unwrap();
        assert!(target.exists());

        uninstall_binary(&target).unwrap();
        assert!(!target.exists());
    }

    #[test]
    fn test_uninstall_binary_idempotent() {
        let tmp_dir = TempDir::new().unwrap();
        let target = tmp_dir.path().join("ccg");

        File::create(&target).unwrap();

        uninstall_binary(&target).unwrap();
        assert!(!target.exists());

        uninstall_binary(&target).unwrap();
        assert!(!target.exists());
    }
}
