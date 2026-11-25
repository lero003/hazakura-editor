import Foundation

/// Writes only the bounded, single-disk ZIP STORE profile needed by EPUB export.
package enum EPUBStoredArchive {
    /// Limit for the complete ZIP, including both sets of headers and the directory footer.
    package static let byteLimit: Int = 16 * 1024 * 1024

    package enum ArchiveError: Error, Equatable {
        case tooLarge, tooManyEntries, invalidPath, duplicatePath
    }

    // The caller supplies up to 128 chapters plus container.xml, the OPF, and the nav.
    private static let entryLimit = 131
    private static let pathByteLimit = 255
    private static let localHeaderSize = 30
    private static let centralHeaderSize = 46
    private static let endRecordSize = 22
    private static let chunkSize = 64 * 1024
    private static let localSignature: UInt32 = 0x0403_4B50
    private static let mimetypeName = Array("mimetype".utf8)
    private static let mimetypeData = Data("application/epub+zip".utf8)
    private static let mimetypeCRC: UInt32 = 0x2CAB_616F

    private struct Entry {
        let name: [UInt8]
        let data: Data

        var headerBytes: Int { localHeaderSize + centralHeaderSize + 2 * name.count }
    }

    /// Inserts the required `mimetype` first. Callers supply the remaining generated paths in order.
    package static func build(entries: [(path: String, data: Data)]) throws -> Data {
        try Task.checkCancellation()
        guard entries.count <= entryLimit else { throw ArchiveError.tooManyEntries }

        let mimetype = Entry(name: mimetypeName, data: mimetypeData)
        var validated = [mimetype]
        var paths: Set<String> = ["mimetype"]
        var totalBytes = endRecordSize + mimetype.headerBytes + mimetypeData.count
        for (path, data) in entries {
            try Task.checkCancellation()
            let entry = Entry(name: try safeNameBytes(for: path), data: data)
            guard paths.insert(path.lowercased()).inserted else { throw ArchiveError.duplicatePath }
            // Check by subtraction so even an oversized input count isn't added unchecked.
            guard entry.headerBytes <= byteLimit - totalBytes,
                  data.count <= byteLimit - totalBytes - entry.headerBytes else {
                throw ArchiveError.tooLarge
            }
            totalBytes += entry.headerBytes + data.count
            validated.append(entry)
        }
        for path in paths {
            try Task.checkCancellation()
            // Files cannot also be parent directories, including under case-insensitive extraction.
            for separator in path.indices where path[separator] == "/" {
                guard paths.contains(String(path[..<separator])) == false else {
                    throw ArchiveError.duplicatePath
                }
            }
        }

        try Task.checkCancellation()
        var archive = Data()
        archive.reserveCapacity(totalBytes)
        var directory = Data()
        for (index, entry) in validated.enumerated() {
            try Task.checkCancellation()
            let crc = index == 0 ? mimetypeCRC : try checksum(entry.data)
            // Validated counts/lengths are far below ZIP32 field limits.
            let localOffset = UInt32(archive.count)
            let size = UInt32(entry.data.count)
            let nameSize = UInt16(entry.name.count)
            archive.appendZIPInteger(localSignature)
            appendEntryFields(to: &archive, crc: crc, size: size, nameSize: nameSize)
            archive.append(contentsOf: entry.name)
            try appendPayload(entry.data, to: &archive)

            directory.appendZIPInteger(UInt32(0x0201_4B50))
            directory.appendZIPInteger(UInt16(20)) // made by ZIP 2.0, DOS
            appendEntryFields(to: &directory, crc: crc, size: size, nameSize: nameSize)
            directory.appendZIPInteger(UInt16(0)) // comment length
            directory.appendZIPInteger(UInt16(0)) // starting disk
            directory.appendZIPInteger(UInt16(0)) // internal attributes
            directory.appendZIPInteger(UInt32(0x20)) // DOS archive bit (regular file)
            directory.appendZIPInteger(localOffset)
            directory.append(contentsOf: entry.name)
        }

        try Task.checkCancellation()
        let directoryOffset = UInt32(archive.count)
        archive.append(directory)
        archive.appendZIPInteger(UInt32(0x0605_4B50))
        archive.appendZIPInteger(UInt16(0)) // this disk
        archive.appendZIPInteger(UInt16(0)) // directory disk
        archive.appendZIPInteger(UInt16(validated.count)) // entries on disk
        archive.appendZIPInteger(UInt16(validated.count)) // entries total
        archive.appendZIPInteger(UInt32(directory.count))
        archive.appendZIPInteger(directoryOffset)
        archive.appendZIPInteger(UInt16(0)) // comment length
        try Task.checkCancellation()
        return archive
    }

    /// Checks the first local record only, not the rest of the ZIP or its EPUB documents.
    package static func hasMimetypePrefix(_ data: Data) -> Bool {
        let nameEnd = localHeaderSize + mimetypeName.count
        let payloadEnd = nameEnd + mimetypeData.count
        guard data.count >= payloadEnd else { return false }
        return data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            bytes.loadUnaligned(fromByteOffset: 0, as: UInt32.self).littleEndian == localSignature
                && bytes.loadUnaligned(fromByteOffset: 6, as: UInt16.self) == 0 // flags
                && bytes.loadUnaligned(fromByteOffset: 8, as: UInt16.self) == 0 // STORE
                && bytes.loadUnaligned(fromByteOffset: 14, as: UInt32.self).littleEndian == mimetypeCRC
                && bytes.loadUnaligned(fromByteOffset: 18, as: UInt32.self).littleEndian == UInt32(mimetypeData.count)
                && bytes.loadUnaligned(fromByteOffset: 22, as: UInt32.self).littleEndian == UInt32(mimetypeData.count)
                && bytes.loadUnaligned(fromByteOffset: 26, as: UInt16.self).littleEndian == UInt16(mimetypeName.count)
                && bytes.loadUnaligned(fromByteOffset: 28, as: UInt16.self) == 0 // extra length
                && bytes[localHeaderSize..<nameEnd].elementsEqual(mimetypeName)
                && bytes[nameEnd..<payloadEnd].elementsEqual(mimetypeData)
        }
    }

    private static func safeNameBytes(for path: String) throws -> [UInt8] {
        let bytes = Array(path.utf8.prefix(pathByteLimit + 1))
        guard bytes.isEmpty == false, bytes.count <= pathByteLimit else { throw ArchiveError.invalidPath }
        // Only explicit ASCII path components; no path normalization or URL decoding.
        for component in bytes.split(separator: 0x2F, omittingEmptySubsequences: false) {
            guard let first = component.first, isASCIILetterOrDigit(first), component.last != 0x2E,
                  component.allSatisfy({ isASCIILetterOrDigit($0) || $0 == 0x2D || $0 == 0x2E || $0 == 0x5F }),
                  isReservedDeviceName(component) == false else {
                throw ArchiveError.invalidPath
            }
        }
        return bytes
    }

    private static func isASCIILetterOrDigit(_ byte: UInt8) -> Bool {
        (0x41...0x5A).contains(byte) || (0x61...0x7A).contains(byte) || (0x30...0x39).contains(byte)
    }

    private static func isReservedDeviceName(_ component: ArraySlice<UInt8>) -> Bool {
        let stem = component.prefix { $0 != 0x2E }
        let name = String(decoding: stem, as: UTF8.self).lowercased()
        switch name {
        case "con", "prn", "aux", "nul": return true
        default:
            guard stem.count == 4, let last = stem.last, (0x30...0x39).contains(last) else { return false }
            return name.hasPrefix("com") || name.hasPrefix("lpt")
        }
    }

    // Shared portion of local and central headers, from version-needed through extra length.
    private static func appendEntryFields(to output: inout Data, crc: UInt32, size: UInt32, nameSize: UInt16) {
        output.appendZIPInteger(UInt16(20)) // version needed
        output.appendZIPInteger(UInt16(0)) // flags: no encryption or data descriptor
        output.appendZIPInteger(UInt16(0)) // STORE
        output.appendZIPInteger(UInt16(0)) // DOS time 00:00:00
        output.appendZIPInteger(UInt16(0x21)) // DOS date 1980-01-01 (deterministic)
        output.appendZIPInteger(crc)
        output.appendZIPInteger(size) // compressed size equals uncompressed size
        output.appendZIPInteger(size)
        output.appendZIPInteger(nameSize)
        output.appendZIPInteger(UInt16(0)) // no extra field
    }

    // Reflected IEEE CRC-32, as specified by ZIP; independent of locale, date, and system tools.
    private static let crcTable: [UInt32] = (0..<256).map { entry in
        var value = UInt32(entry)
        for _ in 0..<8 {
            value = (value >> 1) ^ (value & 1 == 1 ? 0xEDB8_8320 : 0)
        }
        return value
    }

    private static func checksum(_ payload: Data) throws -> UInt32 {
        let table = crcTable
        return try payload.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            var crc = UInt32.max
            for start in stride(from: 0, to: bytes.count, by: chunkSize) {
                try Task.checkCancellation()
                let end = min(start + chunkSize, bytes.count)
                for index in start..<end {
                    let lookup = Int((crc ^ UInt32(bytes[index])) & 0xFF)
                    crc = (crc >> 8) ^ table[lookup]
                }
            }
            return ~crc
        }
    }

    private static func appendPayload(_ payload: Data, to archive: inout Data) throws {
        try payload.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            for start in stride(from: 0, to: bytes.count, by: chunkSize) {
                try Task.checkCancellation()
                let end = min(start + chunkSize, bytes.count)
                archive.append(contentsOf: UnsafeRawBufferPointer(rebasing: bytes[start..<end]))
            }
        }
    }
}

private extension Data {
    mutating func appendZIPInteger<T: FixedWidthInteger>(_ value: T) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { append(contentsOf: $0) }
    }
}
