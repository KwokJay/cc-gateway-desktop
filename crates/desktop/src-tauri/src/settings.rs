use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub start_minimized: bool,
}

impl DesktopSettings {
    pub fn default_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
        Ok(home.join(".ccgw").join("desktop-settings.json"))
    }

    pub fn load() -> Result<Self, String> {
        Self::load_from_path(&Self::default_path()?)
    }

    pub fn save(&self) -> Result<(), String> {
        Self::save_to_path(&Self::default_path()?, self)
    }

    fn load_from_path(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)
            .map_err(|error| format!("Failed to read desktop settings: {error}"))?;

        serde_json::from_str(&content)
            .map_err(|error| format!("Failed to parse desktop settings: {error}"))
    }

    fn save_to_path(path: &Path, settings: &Self) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create settings directory: {error}"))?;
        }

        let content = serde_json::to_string_pretty(settings)
            .map_err(|error| format!("Failed to serialize desktop settings: {error}"))?;

        fs::write(path, content)
            .map_err(|error| format!("Failed to save desktop settings: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::DesktopSettings;
    use tempfile::TempDir;

    #[test]
    fn missing_settings_file_uses_defaults() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("desktop-settings.json");

        let settings = DesktopSettings::load_from_path(&path).unwrap();

        assert_eq!(settings, DesktopSettings::default());
    }

    #[test]
    fn settings_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("desktop-settings.json");
        let settings = DesktopSettings {
            start_minimized: true,
        };

        DesktopSettings::save_to_path(&path, &settings).unwrap();

        let loaded = DesktopSettings::load_from_path(&path).unwrap();
        assert_eq!(loaded, settings);
    }
}
