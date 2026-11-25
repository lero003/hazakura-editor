import Foundation
import HazakuraNextCore
import Testing

struct SourceEqualityTests {
    enum Storage: CaseIterable {
        case swift, foundation

        func snapshot(_ source: String) throws -> String {
            switch self {
            case .swift:
                String(decoding: Array(source.utf8), as: UTF8.self)
            case .foundation:
                try #require(NSMutableString(string: source).copy() as? NSString) as String
            }
        }
    }

    @Test(arguments: Storage.allCases, Storage.allCases)
    func matchesTheUTF8ByteContract(_ leftStorage: Storage, _ rightStorage: Storage) throws {
        let prefix = String(repeating: "原稿👩‍💻\r\n", count: 200)
        let pairs = [
            ("", ""), ("", "🌸"),
            (prefix + "末", prefix + "末"), (prefix + "甲", prefix + "乙"),
            (prefix + "が", prefix + "か\u{3099}"), (prefix + "末\r\n", prefix + "末\n"),
            (prefix + "\u{FEFF}", prefix), (prefix + "\0甲", prefix + "\0乙"),
            (prefix + "😀", prefix + "😃"),
        ]
        for (left, right) in pairs {
            let lhs = try leftStorage.snapshot(left)
            let rhs = try rightStorage.snapshot(right)
            #expect(SourceEquality.matches(lhs, rhs) == left.utf8.elementsEqual(right.utf8))
        }
    }
}
