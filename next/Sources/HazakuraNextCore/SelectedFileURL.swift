import Foundation

/// Shared URL form check. Each file operation still validates its own host and path.
enum SelectedFileURL {
    static func hasNoExtraComponents(_ url: URL) -> Bool {
        guard url.isFileURL, url.baseURL == nil,
              url.query(percentEncoded: true) == nil, url.fragment(percentEncoded: true) == nil else { return false }

        // Typed accessors can return nil for empty or overflowing ports and undecodable userinfo.
        // Examine only the authority delimiters, never the punctuation in the selected path.
        let afterScheme = url.absoluteString.utf8.dropFirst("file:".utf8.count)
        guard afterScheme.starts(with: "//".utf8) else { return true }
        let authority = afterScheme.dropFirst(2).prefix { $0 != 0x2F } // /
        return !authority.contains { $0 == 0x3A || $0 == 0x40 } // : or @
    }
}
