use std::sync::OnceLock;

use regex::{Captures, Regex};
use sha2::{Digest, Sha256};

use crate::config::PromptEnvConfig;

const CCH_SALT: &str = "59cf53e54c78";
const CCH_POSITIONS: [usize; 3] = [4, 7, 20];

pub fn rewrite_prompt_text(text: &str, prompt_env: &PromptEnvConfig) -> String {
    let mut rewritten = platform_regex()
        .replace_all(text, format!("Platform: {}", prompt_env.platform))
        .into_owned();
    rewritten = shell_regex()
        .replace_all(&rewritten, format!("Shell: {}", prompt_env.shell))
        .into_owned();
    rewritten = os_version_regex()
        .replace_all(&rewritten, format!("OS Version: {}", prompt_env.os_version))
        .into_owned();
    rewritten = working_directory_regex()
        .replace_all(&rewritten, |captures: &Captures<'_>| {
            format!("{}{}", &captures[1], prompt_env.working_dir)
        })
        .into_owned();
    home_directory_regex()
        .replace_all(&rewritten, canonical_home_prefix(prompt_env))
        .into_owned()
}

pub fn rewrite_system_reminders(text: &str, prompt_env: &PromptEnvConfig) -> String {
    system_reminder_regex()
        .replace_all(text, |captures: &Captures<'_>| {
            format!(
                "{}{}{}",
                &captures[1],
                rewrite_prompt_text(&captures[2], prompt_env),
                &captures[3]
            )
        })
        .into_owned()
}

pub fn compute_cch(first_user_message_text: &str, version: &str) -> String {
    let selected: String = CCH_POSITIONS
        .iter()
        .map(|index| {
            first_user_message_text
                .as_bytes()
                .get(*index)
                .copied()
                .map(char::from)
                .unwrap_or('0')
        })
        .collect();
    let mut hasher = Sha256::new();
    hasher.update(format!("{CCH_SALT}{selected}{version}"));

    format!("{:x}", hasher.finalize())[..3].to_string()
}

pub fn strip_billing_header(text: &str) -> String {
    billing_header_regex().replace_all(text, "").into_owned()
}

fn canonical_home_prefix(prompt_env: &PromptEnvConfig) -> &str {
    home_prefix_regex()
        .find(&prompt_env.working_dir)
        .map(|matched| matched.as_str())
        .unwrap_or("/Users/user/")
}

fn platform_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"Platform:\s*\S+").unwrap())
}

fn shell_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"Shell:\s*\S+").unwrap())
}

fn os_version_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"OS Version:\s*[^\n<]+").unwrap())
}

fn working_directory_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"((?:Primary )?[Ww]orking directory:\s*)/\S+").unwrap())
}

fn home_directory_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"/(?:Users|home)/[^/\s]+/").unwrap())
}

fn home_prefix_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"^/[^/]+/[^/]+/").unwrap())
}

fn system_reminder_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?s)(<system-reminder>)(.*?)(</system-reminder>)").unwrap())
}

fn billing_header_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"x-anthropic-billing-header:[^\n]+\n?").unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::PromptEnvConfig;

    fn prompt_env() -> PromptEnvConfig {
        PromptEnvConfig {
            platform: "darwin".to_string(),
            shell: "zsh".to_string(),
            os_version: "Darwin 24.4.0".to_string(),
            working_dir: "/Users/jack/projects".to_string(),
        }
    }

    #[test]
    fn rewrites_platform_shell_and_os_version() {
        let rewritten = rewrite_prompt_text(
            "Platform: linux\nShell: bash\nOS Version: Linux 6.5.0",
            &prompt_env(),
        );

        assert!(rewritten.contains("Platform: darwin"));
        assert!(rewritten.contains("Shell: zsh"));
        assert!(rewritten.contains("OS Version: Darwin 24.4.0"));
    }

    #[test]
    fn rewrites_working_directory_and_home_paths() {
        let rewritten = rewrite_prompt_text(
            "Primary working directory: /home/bob/myproject\nCache: /home/bob/.cache/claude",
            &prompt_env(),
        );

        assert!(rewritten.contains("Primary working directory: /Users/jack/projects"));
        assert!(!rewritten.contains("/home/bob/"));
    }

    #[test]
    fn rewrites_only_system_reminder_blocks() {
        let rewritten = rewrite_system_reminders(
            "user text /home/alice/ stays\n<system-reminder>Working directory: /home/alice/code</system-reminder>",
            &prompt_env(),
        );

        assert!(rewritten.contains("user text /home/alice/ stays"));
        assert!(rewritten.contains(
            "<system-reminder>Working directory: /Users/jack/projects</system-reminder>"
        ));
    }

    #[test]
    fn strips_billing_header_blocks() {
        let rewritten = strip_billing_header(
            "x-anthropic-billing-header: cc_version=2.1.81.a1b; cc_entrypoint=cli; cch=00000;\nOther content here.",
        );

        assert!(!rewritten.contains("billing-header"));
        assert!(!rewritten.contains("cc_version"));
        assert!(rewritten.contains("Other content here."));
    }

    #[test]
    fn computes_cch_hash_compatible_with_typescript() {
        assert_eq!(
            compute_cch("hello from canonical user message", "2.1.81"),
            "0ea"
        );
    }
}
