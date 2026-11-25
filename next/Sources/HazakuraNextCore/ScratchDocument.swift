import Foundation

/// One in-memory Markdown document. No backing URL, save baseline, or recovery store.
public struct ScratchDocument: Identifiable {
    public let id: UUID
    public private(set) var source: String
    public private(set) var revision: UInt64 = 0

    public init(source: String) {
        id = UUID()
        self.source = source
    }

    /// Use exact UTF-8 equality: canonically equivalent Swift Strings can have different source bytes.
    public mutating func replaceSource(_ newSource: String) {
        guard !source.utf8.elementsEqual(newSource.utf8) else { return }
        source = newSource
        revision += 1
    }
}
