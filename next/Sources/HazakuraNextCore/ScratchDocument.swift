import Foundation

/// One in-memory Markdown document. No backing URL, save baseline, or recovery store.
public struct ScratchDocument: Identifiable {
    public let id: UUID
    public private(set) var source: String
    public private(set) var revision: UInt64

    public init(source: String) {
        self.init(source: source, revision: 0)
    }

    init(recoveredSource: String) {
        self.init(source: recoveredSource, revision: 1)
    }

    private init(source: String, revision: UInt64) {
        id = UUID()
        self.source = source
        self.revision = revision
    }

    /// Use exact UTF-8 equality: canonically equivalent Swift Strings can have different source bytes.
    public mutating func replaceSource(_ newSource: String) {
        guard !SourceEquality.matches(source, newSource) else { return }
        source = newSource
        revision += 1
    }
}
