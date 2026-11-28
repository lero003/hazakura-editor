import Foundation

/// A read-only projection of explicitly selected, already-open tab snapshots.
package enum MarkdownBookPreview {
    package struct Source: Sendable, Identifiable {
        package let id: UUID
        package let title: String
        package let text: String

        package init(id: UUID, title: String, text: String) {
            self.id = id
            self.title = title
            self.text = text
        }
    }

    package struct Section: Sendable, Identifiable {
        package let id: UUID
        package let title: String
        package let blocks: [MarkdownPreview.Block]
    }

    package enum Failure: Error, Sendable, Equatable {
        case invalidSelection
        case tooLarge
        case unavailable(sectionID: UUID, MarkdownPreview.Limit)
    }

    private static let totalByteLimit = 256 * 1_024

    @concurrent
    package static func render(_ sources: [Source]) async throws -> [Section] {
        try Task.checkCancellation()
        guard (2...8).contains(sources.count), Set(sources.map(\.id)).count == sources.count else {
            throw Failure.invalidSelection
        }

        // Check the total Markdown bytes before parsing, inspecting at most one byte over budget.
        var remainingBytes = totalByteLimit
        for source in sources {
            try Task.checkCancellation()
            let bytes = source.text.utf8.prefix(remainingBytes + 1).count
            try Task.checkCancellation()
            guard bytes <= remainingBytes else { throw Failure.tooLarge }
            remainingBytes -= bytes
        }

        var sections: [Section] = []
        sections.reserveCapacity(sources.count)
        for source in sources {
            try Task.checkCancellation()
            // Parsing each chapter separately keeps fences and reference definitions local.
            let result = try await MarkdownPreview.render(source.text)
            try Task.checkCancellation()
            switch result {
            case .rendered(let blocks):
                sections.append(Section(id: source.id, title: source.title, blocks: blocks))
            case .unavailable(let limit):
                throw Failure.unavailable(sectionID: source.id, limit)
            }
        }
        return sections
    }
}
