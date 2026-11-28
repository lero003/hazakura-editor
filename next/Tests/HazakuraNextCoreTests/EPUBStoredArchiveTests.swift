import Foundation
import HazakuraNextCore
import Testing

struct EPUBStoredArchiveTests {
    private typealias ArchiveError = EPUBStoredArchive.ArchiveError

    @Test func emptyInputProducesExactMimetypeOnlyZIP() throws {
        // Reference bytes from an independent ZIP writer, using STORE and 1980-01-01.
        let hex = """
            50 4b 03 04 14 00 00 00 00 00 00 00 21 00 6f 61 ab 2c
            14 00 00 00 14 00 00 00 08 00 00 00 6d 69 6d 65 74 79
            70 65 61 70 70 6c 69 63 61 74 69 6f 6e 2f 65 70 75 62
            2b 7a 69 70 50 4b 01 02 14 00 14 00 00 00 00 00 00 00
            21 00 6f 61 ab 2c 14 00 00 00 14 00 00 00 08 00 00 00
            00 00 00 00 00 00 20 00 00 00 00 00 00 00 6d 69 6d 65
            74 79 70 65 50 4b 05 06 00 00 00 00 01 00 01 00 36 00
            00 00 3a 00 00 00 00 00
            """
        let expected = try hex.split(whereSeparator: \.isWhitespace).map { try #require(UInt8($0, radix: 16)) }
        let archive = try EPUBStoredArchive.build(entries: [])
        #expect(archive == Data(expected))
    }

    @Test func storedPayloadsAndCRCsAgreeInLocalAndCentralRecords() throws {
        let first = Data("123456789".utf8) // Standard CRC-32 check vector.
        let second = Data([0, 255, 13, 128, 239, 187, 191])
        // Exercise a Data slice without assuming any particular collection startIndex.
        let prefixed = Data(repeating: 0x7F, count: 32) + second
        let archive = try EPUBStoredArchive.build(entries: [
            ("EPUB/chapter-1.xhtml", first), ("EPUB/chapter-2.xhtml", prefixed.dropFirst(32)),
        ])
        let bytes = Array(archive)
        let end = 360
        try #require(bytes.count == end + 22)
        #expect(u32(bytes, end) == 0x0605_4B50)
        #expect(u16(bytes, end + 4) == 0)
        #expect(u16(bytes, end + 6) == 0)
        #expect(u16(bytes, end + 8) == 3)
        #expect(u16(bytes, end + 10) == 3)
        #expect(u32(bytes, end + 12) == 186)
        #expect(u32(bytes, end + 16) == 174)
        #expect(u16(bytes, end + 20) == 0)

        let expected: [(local: Int, central: Int, path: String, data: Data, crc: UInt32)] = [
            (0, 174, "mimetype", Data("application/epub+zip".utf8), 0x2CAB_616F),
            (58, 228, "EPUB/chapter-1.xhtml", first, 0xCBF4_3926),
            (117, 294, "EPUB/chapter-2.xhtml", second, 0x9230_48CB),
        ]
        for entry in expected {
            let local = entry.local
            let central = entry.central
            let name = Array(entry.path.utf8)
            #expect(u32(bytes, local) == 0x0403_4B50)
            #expect(u32(bytes, central) == 0x0201_4B50)
            #expect(u32(bytes, central + 42) == UInt32(local))
            #expect(u16(bytes, central + 32) == 0) // no file comment
            #expect(u16(bytes, central + 34) == 0) // first disk
            // Fields from version-needed through extra length are identical in both records.
            #expect(bytes[(local + 4)..<(local + 30)] == bytes[(central + 6)..<(central + 32)])
            #expect(u16(bytes, local + 6) == 0) // no data descriptor or encryption
            #expect(u16(bytes, local + 8) == 0) // STORE
            #expect(u32(bytes, local + 14) == entry.crc)
            #expect(u32(bytes, local + 18) == UInt32(entry.data.count))
            #expect(u32(bytes, local + 22) == UInt32(entry.data.count))
            #expect(u16(bytes, local + 26) == UInt16(name.count))
            #expect(u16(bytes, local + 28) == 0)
            let payloadStart = local + 30 + name.count
            #expect(bytes[(local + 30)..<payloadStart].elementsEqual(name))
            #expect(bytes[(central + 46)..<(central + 46 + name.count)].elementsEqual(name))
            #expect(bytes[payloadStart..<(payloadStart + entry.data.count)].elementsEqual(entry.data))
        }
    }

    @Test func recognizesOnlyTheExpectedMimetypeLocalRecord() throws {
        let archive = try EPUBStoredArchive.build(entries: [])
        let prefix = archive.prefix(58)
        #expect(EPUBStoredArchive.hasMimetypePrefix(archive))
        #expect(EPUBStoredArchive.hasMimetypePrefix(prefix))
        #expect(EPUBStoredArchive.hasMimetypePrefix((Data(repeating: 0, count: 40) + prefix).dropFirst(40)))
        #expect(EPUBStoredArchive.hasMimetypePrefix(prefix.dropLast()) == false)
        #expect(EPUBStoredArchive.hasMimetypePrefix(Data()) == false)
        // Signature, flags, method, CRC, both sizes, name length, extra length, name, payload.
        for offset in [0, 6, 8, 14, 18, 22, 26, 28, 30, 57] {
            var badPrefix = prefix
            badPrefix[offset] ^= 0x08
            #expect(EPUBStoredArchive.hasMimetypePrefix(badPrefix) == false, "Corrupt offset: \(offset)")
        }
    }

    @Test(arguments: [
        "", "../a", "EPUB/../a", "EPUB/./a", "/EPUB/a", "EPUB//a", "EPUB/", "EPUB\\a",
        "C:/a", "file:///a", "EPUB/%2e%2e/a", "EPUB/章.xhtml", "EPUB/a\u{0}.xhtml", "EPUB/a b",
        "EPUB/.hidden", "EPUB/a.", "EPUB/CON.xhtml", "EPUB/LPT1.xhtml", String(repeating: "a", count: 256),
    ])
    func rejectsUnsafeArchivePaths(_ path: String) {
        #expect(throws: ArchiveError.invalidPath) { try EPUBStoredArchive.build(entries: [(path, Data())]) }
    }

    @Test(arguments: [
        ["mimetype"], ["MiMeTyPe"], ["mimetype/file"],
        ["EPUB/a", "EPUB/a"], ["EPUB/a", "epub/A"],
        ["EPUB/a", "epub/A/b"], ["EPUB/A/b", "epub/a"],
    ])
    func rejectsDuplicatesAndFileDirectoryConflicts(_ names: [String]) {
        let entries = names.map { (path: $0, data: Data()) }
        #expect(throws: ArchiveError.duplicatePath) { try EPUBStoredArchive.build(entries: entries) }
    }

    @Test func accepts128ChaptersAndThreeMetadataFilesButRejectsOneMore() throws {
        let names = ["META-INF/container.xml", "EPUB/package.opf", "EPUB/nav.xhtml"]
            + (1...128).map { "EPUB/chapter-\($0).xhtml" }
        let entries = names.map { (path: $0, data: Data()) }
        let archive = try EPUBStoredArchive.build(entries: entries)
        let end = archive.suffix(22)
        try #require(end.count == 22)
        #expect(u16(Array(end), 10) == 132)
        #expect(throws: ArchiveError.tooManyEntries) {
            try EPUBStoredArchive.build(entries: entries + [("EPUB/extra.xhtml", Data())])
        }
    }

    @Test func sizeLimitIncludesHeadersAndAllPayloads() throws {
        let limit = 16 * 1024 * 1024
        #expect(EPUBStoredArchive.byteLimit == limit)
        // 134 mandatory bytes plus 30 local header + 46 central header + 2 * 20 name bytes.
        var payload = Data(repeating: 0xAD, count: limit - 250)
        let archive = try EPUBStoredArchive.build(entries: [("EPUB/chapter-1.xhtml", payload)])
        #expect(archive.count == limit)

        payload.append(0xAD)
        #expect(throws: ArchiveError.tooLarge) {
            try EPUBStoredArchive.build(entries: [("EPUB/chapter-1.xhtml", payload)])
        }
        let half = Data(repeating: 0, count: limit / 2)
        #expect(throws: ArchiveError.tooLarge) {
            try EPUBStoredArchive.build(entries: [("EPUB/chapter-1.xhtml", half), ("EPUB/chapter-2.xhtml", half)])
        }
    }

    @Test func alreadyCancelledTaskThrowsEvenWithoutCallerEntries() async {
        await withThrowingTaskGroup(of: Data.self) { group in
            group.cancelAll()
            group.addTask { try EPUBStoredArchive.build(entries: []) }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }

    private func u16(_ bytes: [UInt8], _ offset: Int) -> UInt16 {
        UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
    }

    private func u32(_ bytes: [UInt8], _ offset: Int) -> UInt32 {
        UInt32(u16(bytes, offset)) | (UInt32(u16(bytes, offset + 2)) << 16)
    }
}
