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
