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
    let mut out = String::new();
    let mut blank_run = 0usize;
    for line in text.lines() {
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
}
