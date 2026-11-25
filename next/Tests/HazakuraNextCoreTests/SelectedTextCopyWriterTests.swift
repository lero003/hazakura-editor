import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct SelectedTextCopyWriterTests {
    private typealias WriteError = SelectedTextCopyWriter.WriteError
    private static let bom = Data([0xEF, 0xBB, 0xBF])

    @Test(arguments: ["", "# か\u{3099}\r\n🌸\n\t末尾\r", "\u{FEFF}本文"], [false, true])
    func writesExactUTF8WithOnlyTheRequestedPrefix(_ source: String, _ preservingBOM: Bool) async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("原稿 #%.md")
            try await SelectedTextCopyWriter.write(source: source, preservingUTF8BOM: preservingBOM, to: destination)

            let expected = (preservingBOM ? Self.bom : Data()) + Data(source.utf8)
            #expect(try Data(contentsOf: destination) == expected)
            let attributes = try FileManager.default.attributesOfItem(atPath: destination.path(percentEncoded: false))
            #expect(attributes[.type] as? FileAttributeType == .typeRegular)
            #expect(attributes[.posixPermissions] as? Int == 0o600)
            #expect(try entries(in: folder) == ["原稿 #%.md"])
        }
    }

    @Test func refusesExistingFilesAndHardLinksWithoutChangingTheSource() async throws {
        try await withFixture { folder in
            let source = folder.appendingPathComponent("source.txt")
            let linked = folder.appendingPathComponent("hard-link.txt")
            let original = Data("original\r\n".utf8)
            try original.write(to: source)
            try FileManager.default.linkItem(at: source, to: linked)

            for existing in [source, linked] {
                await #expect(throws: WriteError.alreadyExists) {
                    try await SelectedTextCopyWriter.write(source: "edited", preservingUTF8BOM: false, to: existing)
                }
                #expect(try Data(contentsOf: existing) == original)
            }
            let sourceAttributes = try FileManager.default.attributesOfItem(atPath: source.path(percentEncoded: false))
            let linkAttributes = try FileManager.default.attributesOfItem(atPath: linked.path(percentEncoded: false))
            #expect(sourceAttributes[.systemFileNumber] as? Int == linkAttributes[.systemFileNumber] as? Int)
            #expect(try entries(in: folder) == ["source.txt", "hard-link.txt"])
        }
    }

    @Test func refusesLeafAndAncestorSymlinksIncludingDanglingLinks() async throws {
        try await withFixture { folder in
            let real = folder.appendingPathComponent("real", isDirectory: true)
            try FileManager.default.createDirectory(at: real, withIntermediateDirectories: false)
            let content = real.appendingPathComponent("original.txt")
            let uncreated = real.appendingPathComponent("does-not-exist.txt")
            let original = Data("unchanged".utf8)
            try original.write(to: content)
            let leaf = folder.appendingPathComponent("link.txt")
            let dangling = folder.appendingPathComponent("dangling.txt")
            let ancestor = folder.appendingPathComponent("link-dir", isDirectory: false)
            let links = [(leaf, content), (dangling, uncreated), (ancestor, real)]
            for (link, target) in links {
                try FileManager.default.createSymbolicLink(at: link, withDestinationURL: target)
            }
            let originalLinkTargets = try links.map { link, _ in
                try FileManager.default.destinationOfSymbolicLink(atPath: link.path(percentEncoded: false))
            }

            for existing in [leaf, dangling] {
                await #expect(throws: WriteError.alreadyExists) {
                    try await SelectedTextCopyWriter.write(source: "new", preservingUTF8BOM: false, to: existing)
                }
            }
            await #expect(throws: WriteError.invalidLocation) {
                try await SelectedTextCopyWriter.write(
                    source: "new", preservingUTF8BOM: false, to: ancestor.appendingPathComponent("new.txt")
                )
            }

            for ((link, _), originalTarget) in zip(links, originalLinkTargets) {
                #expect(try FileManager.default.destinationOfSymbolicLink(atPath: link.path(percentEncoded: false))
                    == originalTarget)
            }
            #expect(try Data(contentsOf: content) == original)
            #expect(try entries(in: real) == ["original.txt"])
            #expect(try entries(in: folder) == ["dangling.txt", "link-dir", "link.txt", "real"])
        }
    }

    @Test func refusesGroupWritableParentWithoutTouchingExistingEntries() async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("copy.txt")
            let original = folder.appendingPathComponent("original.txt")
            let originalBytes = Data("untouched".utf8)
            try originalBytes.write(to: original)
            try FileManager.default.setAttributes([.posixPermissions: 0o770],
                                                  ofItemAtPath: folder.path(percentEncoded: false))

            await #expect(throws: WriteError.accessDenied) {
                try await SelectedTextCopyWriter.write(source: "edited", preservingUTF8BOM: false, to: destination)
            }
            #expect(try Data(contentsOf: original) == originalBytes)
            #expect(try entries(in: folder) == ["original.txt"])
        }
    }

    @Test(arguments: ["deny:delete", "deny:delete_child", "allow,file_inherit:read"])
    func onlyAcceptsParentACLThatCannotGrantAccessOrPreventStageCleanup(_ rule: String) async throws {
        try await withFixture { folder in
            // The Darwin well-known UUID and group ID for everyone are account-independent.
            let aclText = "!#acl 1\ngroup:ABCDEFAB-CDEF-ABCD-EFAB-CDEF0000000C:everyone:12:\(rule)\n"
            let acl = try #require(acl_from_text(aclText))
            defer { _ = acl_free(UnsafeMutableRawPointer(acl)) }
            let pathname = folder.path(percentEncoded: false)
            try #require(acl_set_file(pathname, ACL_TYPE_EXTENDED, acl) == 0)
            // Clear the fixture's ACL before its enclosing temporary-directory cleanup.
            let emptyACL = try #require(acl_init(0))
            defer {
                _ = acl_set_file(pathname, ACL_TYPE_EXTENDED, emptyACL)
                _ = acl_free(UnsafeMutableRawPointer(emptyACL))
            }
            let destination = folder.appendingPathComponent("copy.txt")
            if rule == "deny:delete" {
                try await SelectedTextCopyWriter.write(source: "text", preservingUTF8BOM: false, to: destination)
                #expect(try Data(contentsOf: destination) == Data("text".utf8))
                #expect(try entries(in: folder) == ["copy.txt"])
            } else {
                await #expect(throws: WriteError.accessDenied) {
                    try await SelectedTextCopyWriter.write(source: "text", preservingUTF8BOM: false, to: destination)
                }
                let remaining = try entries(in: folder)
                #expect(remaining.isEmpty)
            }
        }
    }

    @Test func concurrentWritersToTheSameDestinationCommitExactlyOneCopy() async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("collision.txt")
            let candidates = ["桜", "菊"].map { String(repeating: $0, count: 64 * 1024) }
            let winners = try await withThrowingTaskGroup(of: String?.self) { group in
                for source in candidates {
                    group.addTask {
                        do {
                            try await SelectedTextCopyWriter.write(source: source, preservingUTF8BOM: false, to: destination)
                            return source
                        } catch WriteError.alreadyExists {
                            return nil
                        }
                    }
                }
                var winners: [String] = []
                for try await result in group {
                    if let result { winners.append(result) }
                }
                return winners
            }
            try #require(winners.count == 1)
            #expect(try Data(contentsOf: destination) == Data(winners[0].utf8))
            #expect(try entries(in: folder) == ["collision.txt"])
        }
    }

    @Test func rejectsInvalidLocationsWithoutCreatingAnyEntries() async throws {
        try await withFixture { folder in
            let fixturePath = folder.absoluteString
            let invalidURLs = [
                "https://example.invalid/new.txt", "file://remote.invalid/new.txt", "file:relative.txt",
                fixturePath + "bad%00name.txt", fixturePath + "plain.txt?query", fixturePath + "plain.txt#fragment",
                fixturePath + "new-directory/", fixturePath + "./plain.txt", fixturePath + "missing/new.txt",
                fixturePath + "nested%2Fplain.txt", fixturePath + "/plain.txt",
            ]
            for string in invalidURLs {
                let url = try #require(URL(string: string))
                await #expect(throws: WriteError.invalidLocation) {
                    try await SelectedTextCopyWriter.write(source: "text", preservingUTF8BOM: false, to: url)
                }
            }
            let remaining = try entries(in: folder)
            #expect(remaining.isEmpty)
        }
    }

    @Test(arguments: ["a\u{0}", "a\u{1}", "a\u{B}", "a\u{1B}", "a\u{7F}"])
    func rejectsUnsupportedControlCharacters(_ source: String) async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("not-text.txt")
            await #expect(throws: WriteError.invalidText) {
                try await SelectedTextCopyWriter.write(source: source, preservingUTF8BOM: false, to: destination)
            }
            let remaining = try entries(in: folder)
            #expect(remaining.isEmpty)
        }
    }

    @Test(arguments: [false, true])
    func limitsOnDiskBytesIncludingBOM(_ preservingBOM: Bool) async throws {
        try await withFixture { folder in
            let fits = folder.appendingPathComponent("fits.txt")
            let over = folder.appendingPathComponent("over.txt")
            let limit = 2 * 1024 * 1024
            let prefix = preservingBOM ? Self.bom : Data()
            let bodyCount = limit - prefix.count
            let body = String(repeating: "界", count: bodyCount / 3) + String(repeating: "a", count: bodyCount % 3)

            try await SelectedTextCopyWriter.write(source: body, preservingUTF8BOM: preservingBOM, to: fits)
            #expect(try Data(contentsOf: fits) == prefix + Data(body.utf8))
            await #expect(throws: WriteError.tooLarge) {
                try await SelectedTextCopyWriter.write(source: body + "x", preservingUTF8BOM: preservingBOM, to: over)
            }
            #expect(try entries(in: folder) == ["fits.txt"])
        }
    }

    @Test func preCancelledWriteDoesNotCreateADestinationOrStage() async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("cancelled.txt")
            await #expect(throws: CancellationError.self) {
                try await withThrowingTaskGroup(of: Void.self) { group in
                    group.cancelAll()
                    group.addTask {
                        try await SelectedTextCopyWriter.write(source: "text", preservingUTF8BOM: false, to: destination)
                    }
                    try await group.waitForAll()
                }
            }
            let remaining = try entries(in: folder)
            #expect(remaining.isEmpty)
        }
    }

    private func entries(in folder: URL) throws -> Set<String> {
        Set(try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)))
    }

    private func withFixture(_ test: (URL) async throws -> Void) async throws {
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let root = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let folder = root.appendingPathComponent("hazakura-copy-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        try await test(folder)
    }
}
