import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct SelectedPDFWriterTests {
    private typealias WriteError = SelectedTextCopyWriter.WriteError
    // The renderer validates PDF structure. The writer treats the payload as opaque bytes.
    private static let payload = Data("%PDF-1.7\n".utf8) + Data([0x00, 0xFF, 0x0D, 0x80, 0xEF, 0xBB, 0xBF])

    @Test func writesExactPrivateBytesToDecodedMixedCaseExtension() async throws {
        try await withFixture { folder in
            let selected = try #require(URL(string: folder.absoluteString + "report%20%23%2EPdF"))
            let written = folder.appendingPathComponent("report #.PdF")
            try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: selected)

            #expect(try Data(contentsOf: written) == Self.payload)
            let attributes = try FileManager.default.attributesOfItem(atPath: written.path(percentEncoded: false))
            #expect(attributes[.type] as? FileAttributeType == .typeRegular)
            #expect(attributes[.posixPermissions] as? Int == 0o600)
            #expect(try entries(in: folder) == ["report #.PdF"])
        }
    }

    @Test func refusesExistingDestinationWithoutChangingBytes() async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("existing.pdf")
            let original = Data([0xFA, 0x00, 0xFB])
            try original.write(to: destination)

            await #expect(throws: WriteError.alreadyExists) {
                try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: destination)
            }
            #expect(try Data(contentsOf: destination) == original)
            #expect(try entries(in: folder) == ["existing.pdf"])
        }
    }

    @Test(arguments: [false, true])
    func refusesLeafSymlinksIncludingDanglingLinks(_ dangling: Bool) async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("selected.pdf")
            let target = folder.appendingPathComponent("target.pdf")
            let original = Data([0xAA, 0x00, 0xBB])
            if !dangling { try original.write(to: target) }
            try FileManager.default.createSymbolicLink(at: destination, withDestinationURL: target)
            let path = destination.path(percentEncoded: false)
            let originalLink = try FileManager.default.destinationOfSymbolicLink(atPath: path)

            await #expect(throws: WriteError.alreadyExists) {
                try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: destination)
            }
            #expect(try FileManager.default.destinationOfSymbolicLink(atPath: path) == originalLink)
            if !dangling { #expect(try Data(contentsOf: target) == original) }
            #expect(try entries(in: folder) == (dangling ? ["selected.pdf"] : ["selected.pdf", "target.pdf"]))
        }
    }

    @Test func refusesSymlinkParentAndEncodedSeparator() async throws {
        try await withFixture { folder in
            let realParent = folder.appendingPathComponent("real", isDirectory: true)
            let linkParent = folder.appendingPathComponent("link", isDirectory: false)
            try FileManager.default.createDirectory(at: realParent, withIntermediateDirectories: false)
            try FileManager.default.createSymbolicLink(at: linkParent, withDestinationURL: realParent)
            let viaLink = linkParent.appendingPathComponent("new.pdf")
            let encodedSeparator = try #require(URL(string: folder.absoluteString + "real%2Fnew.pdf"))

            for destination in [viaLink, encodedSeparator] {
                await #expect(throws: WriteError.invalidLocation) {
                    try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: destination)
                }
            }
            let remaining = try entries(in: realParent)
            #expect(remaining.isEmpty)
            #expect(try entries(in: folder) == ["real", "link"])
        }
    }

    @Test(arguments: ["report.txt", "report.pdf.txt", "report", "report%252Epdf"])
    func rejectsWrongExtension(_ encodedLeaf: String) async throws {
        try await withFixture { folder in
            let destination = try #require(URL(string: folder.absoluteString + encodedLeaf))
            await #expect(throws: WriteError.invalidLocation) {
                try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: destination)
            }
            let remaining = try entries(in: folder)
            #expect(remaining.isEmpty)
        }
    }

    @Test(arguments: ["", "%PDF", "%pdf-1.7", " %PDF-1.7", "not PDF"])
    func rejectsEmptyOrNonPDFData(_ content: String) async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("invalid.pdf")
            await #expect(throws: WriteError.invalidPDF) {
                try await SelectedTextCopyWriter.writePDF(data: Data(content.utf8), to: destination)
            }
            let remaining = try entries(in: folder)
            #expect(remaining.isEmpty)
        }
    }

    @Test func enforcesSixteenMiBIncludingMagicBytes() async throws {
        try await withFixture { folder in
            let fits = folder.appendingPathComponent("fits.pdf")
            let over = folder.appendingPathComponent("over.pdf")
            let limit = 16 * 1024 * 1024
            #expect(SelectedTextCopyWriter.pdfByteLimit == limit)
            var data = Self.payload
            data.append(Data(repeating: 0x00, count: limit - data.count))
            try await SelectedTextCopyWriter.writePDF(data: data, to: fits)
            #expect(try Data(contentsOf: fits) == data)

            data.append(0x00)
            await #expect(throws: WriteError.tooLarge) {
                try await SelectedTextCopyWriter.writePDF(data: data, to: over)
            }
            #expect(try entries(in: folder) == ["fits.pdf"])
        }
    }

    @Test func preCancelledWriteCreatesNeitherDestinationNorStage() async throws {
        try await withFixture { folder in
            let destination = folder.appendingPathComponent("cancelled.pdf")
            await #expect(throws: CancellationError.self) {
                try await withThrowingTaskGroup(of: Void.self) { group in
                    group.cancelAll()
                    group.addTask {
                        try await SelectedTextCopyWriter.writePDF(data: Self.payload, to: destination)
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
        let folder = root.appendingPathComponent("hazakura-pdf-writer-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false,
                                                attributes: [.posixPermissions: 0o700])
        defer { try? FileManager.default.removeItem(at: folder) }
        try await test(folder)
    }
}
