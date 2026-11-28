@testable import HazakuraNext
import Foundation
import Testing

struct BoundedTextPreviewTests {
    @Test func keepsAllBytesWhenLimitIsAnExactFit() {
        let source = "か\u{3099} 🌸"
        let preview = BoundedTextPreview(source: source, byteLimit: source.utf8.count)
        #expect(Data(preview.text.utf8) == Data(source.utf8))
        #expect(!preview.isTruncated)
    }

    @Test(arguments: ["か\u{3099}", "🇯🇵", "👩🏽‍💻", "\r\n"])
    func retainsOnlyCompleteCharactersAtEveryByteCut(_ character: String) {
        let source = "A" + character + "B"
        let completeCharacterEnd = 1 + character.utf8.count
        for limit in 1...completeCharacterEnd {
            let preview = BoundedTextPreview(source: source, byteLimit: limit)
            let expected = limit == completeCharacterEnd ? "A" + character : "A"
            #expect(preview.text.utf8.elementsEqual(expected.utf8), "Byte limit: \(limit)")
            #expect(preview.isTruncated)
        }
    }

    @Test func anOversizedFirstCharacterIsNotAnEmptySource() {
        let source = "か" + String(repeating: "\u{3099}", count: 1_024)
        let preview = BoundedTextPreview(source: source, byteLimit: 1_024)
        #expect(preview.text.isEmpty)
        #expect(preview.isTruncated)

        let empty = BoundedTextPreview(source: "", byteLimit: 1_024)
        #expect(empty.text.isEmpty)
        #expect(!empty.isTruncated)
    }

    @Test(arguments: [0, 1, 2, 3, 4, 5, 6])
    func dropsTheWholeScalarAtACut(_ limit: Int) {
        let preview = BoundedTextPreview(source: "A🌸B末", byteLimit: limit)
        let expected = switch limit {
        case 0: ""
        case 1...4: "A"
        case 5: "A🌸"
        default: "A🌸B"
        }
        #expect(Data(preview.text.utf8) == Data(expected.utf8))
        #expect(preview.isTruncated)
    }
}
