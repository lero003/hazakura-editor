//! Assemble a single Markdown draft from per-page plain text.
//!
//! Output is always an editable Markdown string. Page markers are
//! ordinary HTML comments so users can delete them freely.

use std::fmt::Write as _;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportPageText {
    pub index: usize,
    pub text: String,
}

/// Build a Markdown draft from ordered page texts.
///
/// Empty pages still get a page comment so the user can see skips.
/// Consecutive blank lines inside a page are collapsed to at most two.
pub fn assemble_import_markdown_draft(
    source_label: &str,
    pages: &[ImportPageText],
) -> String {
    let mut out = String::new();
    let _ = writeln!(
        out,
        "<!-- hazakura:import source={} pages={} -->",
        sanitize_attr(source_label),
        pages.len()
    );
    let _ = writeln!(out);
    let _ = writeln!(
        out,
        "> OCR / テキスト抽出の**下書き**です。保存前に内容を確認・編集してください。"
    );
    let _ = writeln!(out);

    if pages.is_empty() {
        let _ = writeln!(out, "<!-- hazakura:import-empty -->");
        let _ = writeln!(out, "_（抽出結果が空でした）_");
        return out;
    }

    for page in pages {
        let _ = writeln!(
            out,
            "<!-- hazakura:import-page index={} -->",
            page.index
        );
        let _ = writeln!(out);
        let body = normalize_page_text(&page.text);
        if body.is_empty() {
            let _ = writeln!(out, "_（このページのテキストは空です）_");
        } else {
            out.push_str(&body);
            if !body.ends_with('\n') {
                out.push('\n');
            }
        }
        let _ = writeln!(out);
    }

    out
}

fn sanitize_attr(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '"' | '\'' | '<' | '>' | '`' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect()
}

fn normalize_page_text(text: &str) -> String {
    let reflowed = reflow_soft_wrapped_lines(text);
    let mut out = String::new();
    let mut blank_run = 0usize;
    for line in reflowed.lines() {
        let trimmed_end = line.trim_end();
        if trimmed_end.is_empty() {
            blank_run += 1;
            if blank_run <= 2 {
                out.push('\n');
            }
            continue;
        }
        blank_run = 0;
        out.push_str(trimmed_end);
        out.push('\n');
    }
    out.trim_end().to_string()
}

/// Rejoin PDF soft line-breaks that split URLs / paths / shell continuations.
/// Intentionally conservative: over-joining (install.shecho) is worse than
/// leaving a soft wrap.
fn reflow_soft_wrapped_lines(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return String::new();
    }
    let mut out: Vec<String> = Vec::new();
    let mut i = 0usize;
    while i < lines.len() {
        let mut current = lines[i].trim_end().to_string();
        i += 1;
        while i < lines.len() {
            let next = lines[i].trim_end();
            if next.is_empty() || current.is_empty() {
                break;
            }
            if !should_join_soft_wrap(&current, next) {
                break;
            }
            if should_join_without_space(&current, next) {
                current.push_str(next.trim_start());
            } else {
                current.push(' ');
                current.push_str(next.trim_start());
            }
            i += 1;
        }
        out.push(current);
    }
    out.join("\n")
}

fn should_join_soft_wrap(prev: &str, next: &str) -> bool {
    if looks_like_block_start(next) || looks_like_shell_or_prose_start(next) {
        return false;
    }
    let prev_t = prev.trim_end();
    let next_t = next.trim_start();
    if prev_t.is_empty() || next_t.is_empty() {
        return false;
    }
    // Completed URL/path line: do not glue the next statement.
    if looks_like_completed_url_or_path(prev_t) {
        return false;
    }

    // Incomplete URL continued on the next line only.
    if looks_like_incomplete_url(prev_t) {
        return !next_t.starts_with("http://") && !next_t.starts_with("https://");
    }

    // Explicit shell / code line continuation.
    if prev_t.ends_with('\\')
        || prev_t.ends_with('|')
        || prev_t.ends_with("&&")
        || prev_t.ends_with("||")
        || prev_t.ends_with('(')
        || prev_t.ends_with('$')
    {
        return true;
    }
    // Open quote / backtick: only when the line has unbalanced quotes.
    if unbalanced_quotes(prev_t) {
        return true;
    }

    // Hyphenated English wrap.
    if prev_t.ends_with('-')
        && next_t
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        && !looks_like_shell_or_prose_start(next_t)
    {
        return true;
    }

    // Path fragment: previous ends with `/` and next continues the path
    // (not a new absolute path command argument that is a full word command).
    if prev_t.ends_with('/')
        && next_t
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
        && !looks_like_shell_or_prose_start(next_t)
    {
        return true;
    }

    // Japanese mid-sentence wrap: only when previous ends with a connective
    // and the line is reasonably long (avoids "するパス" style merges).
    let last = prev_t.chars().last().unwrap_or(' ');
    let first = next_t.chars().next().unwrap_or(' ');
    if is_cjk(first)
        && is_jp_connective_end(last)
        && prev_t.chars().count() >= 18
        && !looks_like_block_start(prev_t)
    {
        return true;
    }

    false
}

fn should_join_without_space(prev: &str, next: &str) -> bool {
    let prev_t = prev.trim_end();
    let next_t = next.trim_start();
    if looks_like_incomplete_url(prev_t) || prev_t.ends_with('/') {
        return true;
    }
    if prev_t.ends_with('-')
        && next_t
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
    {
        return true;
    }
    let last = prev_t.chars().last().unwrap_or(' ');
    let first = next_t.chars().next().unwrap_or(' ');
    is_cjk(last) && is_cjk(first) && is_jp_connective_end(last)
}

fn looks_like_incomplete_url(line: &str) -> bool {
    let t = line.trim_end();
    let Some(idx) = t.rfind("https://").or_else(|| t.rfind("http://")) else {
        return false;
    };
    let url = &t[idx..];
    // Still incomplete if it ends with scheme slash, single path segment
    // slash, or no TLD-ish end, and does not end with a common terminator.
    if looks_like_completed_url_or_path(url) {
        return false;
    }
    url.ends_with('/')
        || url.ends_with("://")
        || url.ends_with('=')
        || url.ends_with('?')
        || url.ends_with('&')
        || !url.contains('.')
}

fn looks_like_completed_url_or_path(line: &str) -> bool {
    let t = line.trim_end().trim_end_matches([')', ']', '"', '\'', '>', '」']);
    if t.ends_with(".sh")
        || t.ends_with(".md")
        || t.ends_with(".json")
        || t.ends_with(".txt")
        || t.ends_with(".pdf")
        || t.ends_with(".html")
        || t.ends_with(".htm")
        || t.ends_with(".zsh")
        || t.ends_with(".bash")
        || t.ends_with(".py")
        || t.ends_with(".js")
        || t.ends_with(".ts")
        || t.ends_with(".rs")
        || t.ends_with(".app")
        || t.ends_with(".com")
        || t.ends_with(".org")
        || t.ends_with(".net")
        || t.ends_with(".jp")
        || t.ends_with(".io")
    {
        return true;
    }
    // Full http(s) URL without trailing slash often ends with a path segment
    // that has a file-like extension or a complete host/path token.
    if (t.starts_with("http://") || t.starts_with("https://"))
        && !t.ends_with('/')
        && t.chars().filter(|c| *c == '/').count() >= 3
        && t
            .chars()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric())
    {
        // Prefer complete when the last segment looks finished (no trailing -).
        if !t.ends_with('-') && !t.ends_with('_') {
            return true;
        }
    }
    false
}

fn looks_like_shell_or_prose_start(line: &str) -> bool {
    let t = line.trim_start();
    let first = t.split_whitespace().next().unwrap_or("");
    matches!(
        first,
        "echo"
            | "export"
            | "eval"
            | "defaults"
            | "killall"
            | "brew"
            | "npm"
            | "npx"
            | "cd"
            | "python"
            | "python3"
            | "claude"
            | "lms"
            | "hermes"
            | "curl"
            | "git"
            | "cargo"
            | "source"
            | "true"
            | "false"
            | "備考:"
            | "メモ:"
            | "ステップ1："
            | "ステップ2："
            | "ステップ3："
            | "パス:"
    ) || t.starts_with("ステップ")
        || t.starts_with("備考")
        || t.starts_with("メモ")
        || t.starts_with("パス")
        || t.starts_with("カテゴリ")
}

fn unbalanced_quotes(line: &str) -> bool {
    let double = line.chars().filter(|c| *c == '"').count();
    let single = line.chars().filter(|c| *c == '\'').count();
    let ticks = line.chars().filter(|c| *c == '`').count();
    double % 2 == 1 || single % 2 == 1 || ticks % 2 == 1
}

fn is_jp_connective_end(c: char) -> bool {
    matches!(
        c,
        'の' | 'て' | 'で' | 'を' | 'に' | 'は' | 'が' | 'と' | 'も' | 'へ' | 'や' | '、' | '，' | '・'
    )
}

fn looks_like_block_start(line: &str) -> bool {
    let t = line.trim_start();
    if t.is_empty() {
        return true;
    }
    if t.starts_with('#')
        || t.starts_with("- ")
        || t.starts_with("* ")
        || t.starts_with("・")
        || t.starts_with("```")
        || t.starts_with('|')
    {
        return true;
    }
    // Numbered list: "1. " / "12. "
    let mut chars = t.chars().peekable();
    let mut saw_digit = false;
    while let Some(c) = chars.peek().copied() {
        if c.is_ascii_digit() {
            saw_digit = true;
            chars.next();
            continue;
        }
        break;
    }
    if saw_digit {
        if matches!(chars.next(), Some('.' | '．' | ')' | '、')) {
            if matches!(chars.next(), Some(' ' | '\t') | None) {
                return true;
            }
        }
    }
    false
}

fn is_cjk(c: char) -> bool {
    matches!(
        c,
        '\u{3040}'..='\u{30ff}'
            | '\u{3400}'..='\u{4dbf}'
            | '\u{4e00}'..='\u{9fff}'
            | '\u{f900}'..='\u{faff}'
            | '\u{ff66}'..='\u{ff9d}'
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assembles_pages_with_markers() {
        let md = assemble_import_markdown_draft(
            "scan.pdf",
            &[
                ImportPageText {
                    index: 0,
                    text: "Hello\n\n\n\nWorld".into(),
                },
                ImportPageText {
                    index: 1,
                    text: String::new(),
                },
            ],
        );
        assert!(md.contains("hazakura:import source=scan.pdf pages=2"));
        assert!(md.contains("hazakura:import-page index=0"));
        assert!(md.contains("Hello"));
        assert!(md.contains("World"));
        assert!(md.contains("このページのテキストは空"));
        // Collapse excessive blank lines inside a page.
        assert!(!md.contains("Hello\n\n\n\nWorld"));
    }

    #[test]
    fn empty_pages_still_produce_draft() {
        let md = assemble_import_markdown_draft("x.png", &[]);
        assert!(md.contains("import-empty"));
    }

    #[test]
    fn strips_dangerous_chars_from_source_label() {
        let md = assemble_import_markdown_draft("a\"b<script>", &[]);
        // Attribute value is sanitized; raw quote / tag openers must not appear
        // inside the source= field.
        assert!(md.contains("source=a_b_script_"));
        assert!(!md.contains("source=a\"b"));
        assert!(!md.contains("source=a\"b<script>"));
    }

    #[test]
    fn rejoins_soft_wrapped_urls_and_paths() {
        let text = "https://raw.githubusercontent.com/Homebrew/install/HEAD/\ninstall.sh)\necho hi\n";
        let out = normalize_page_text(text);
        assert!(out.contains(
            "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        ));
        assert!(out.contains("echo hi"));
        assert!(!out.contains("install.shecho"));
    }

    #[test]
    fn does_not_glue_shell_after_completed_script_url() {
        let text = concat!(
            "/bin/bash -c \"$(curl -fsSL\n",
            "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh\n",
            "echo >> /Users/keisetsu/.zprofile\n",
            "echo 'eval \"$(/opt/homebrew/bin/brew shellenv zsh)\"' >>\n",
            "/Users/keisetsu/.zprofile\n",
            "eval \"$(/opt/homebrew/bin/brew shellenv zsh)\"\n",
        );
        let out = normalize_page_text(text);
        assert!(out.contains("install.sh"));
        assert!(!out.contains("install.shecho"));
        assert!(!out.contains("zprofileecho"));
        assert!(out.contains("echo >>"));
        assert!(out.lines().any(|l| l.trim_start().starts_with("eval ")));
    }

    #[test]
    fn does_not_join_across_list_items() {
        let text = "1. Homebrew\n2. アプリ一覧\n";
        let out = normalize_page_text(text);
        assert!(out.contains("1. Homebrew\n2. アプリ一覧"));
    }

    #[test]
    fn does_not_overjoin_short_japanese_clauses() {
        let text = "ファイアウォールをオンにする\nパス: 「システム設定」→「ネットワーク」\n";
        let out = normalize_page_text(text);
        assert!(out.contains("オンにする\nパス:"));
    }
}
