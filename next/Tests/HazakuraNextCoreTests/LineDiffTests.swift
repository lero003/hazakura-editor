import HazakuraNextCore
import Testing

struct LineDiffTests {
    @Test(arguments: ["", "原稿\r\n\r末尾👩‍👩‍👦", "e\u{301}\n"])
    func identicalBytes(source: String) async throws {
        #expect(try await LineDiff.compare(before: source, after: source) == .identical)
    }

    @Test(arguments: [("é", "e\u{301}"), ("a\u{0323}\u{0301}", "a\u{0301}\u{0323}")])
    func canonicallyEquivalentTextIsNotByteIdentical(_ original: String, _ modified: String) async throws {
        try #require(original == modified)
        let before = "見出し\n\(original)\n👩‍💻"
        let after = "見出し\n\(modified)\n👩‍💻"
        let result = try await LineDiff.compare(before: before, after: after)
        let rows = try requireRows(result)

        #expect(rows.map(\.kind) == [.unchanged, .removed, .added, .unchanged])
        #expect(rows.map(\.beforeLine) == [1, 2, nil, 3])
        #expect(rows.map(\.afterLine) == [1, nil, 2, 3])
        expectReconstruction(rows, before: before, after: after)
    }

    @Test func literalBOMInSourceIsNotStripped() async throws {
        let before = "\u{FEFF}原稿"
        let after = "原稿"
        let result = try await LineDiff.compare(before: before, after: after)
        let rows = try requireRows(result)

        #expect(rows.map(\.kind) == [.removed, .added])
        expectReconstruction(rows, before: before, after: after)
    }

    @Test func splitsOnlyCRLFCRAndLFAndDoesNotSynthesizeATrailingRow() async throws {
        let source = "甲\r\n\r乙\n丙\u{2028}丁\u{2029}戊\u{0085}己\r\n"
        let result = try await LineDiff.compare(before: "", after: source)
        let rows = try requireRows(result)

        #expect(rows.map(\.kind) == [.added, .added, .added, .added])
        #expect(rows.map(\.text) == ["甲", "", "乙", "丙\u{2028}丁\u{2029}戊\u{0085}己"])
        #expect(rows.map(\.ending) == [.crlf, .cr, .lf, .crlf])
        #expect(rows.map(\.beforeLine) == [nil, nil, nil, nil])
        #expect(rows.map(\.afterLine) == [1, 2, 3, 4])
        expectReconstruction(rows, before: "", after: source)
    }

    @Test func terminatorChangesAreEdits() async throws {
        let before = "同じ\r\n末尾"
        let after = "同じ\n末尾\r"
        let result = try await LineDiff.compare(before: before, after: after)
        let rows = try requireRows(result)

        #expect(rows.filter { $0.kind == .removed }.map(\.ending) == [.crlf, .none])
        #expect(rows.filter { $0.kind == .added }.map(\.ending) == [.lf, .cr])
        #expect(rows.contains { $0.kind == .unchanged } == false)
        expectReconstruction(rows, before: before, after: after)
    }

    @Test func repeatedLinesAlignDeterministicallyWithStableIDsAndLineNumbers() async throws {
        let before = "頭\n甲\n乙\n甲\n尾"
        let after = "頭\n乙\n甲\n乙\n尾"
        let result = try await LineDiff.compare(before: before, after: after)
        let rows = try requireRows(result)

        #expect(rows.map(\.kind) == [.unchanged, .removed, .unchanged, .unchanged, .added, .unchanged])
        #expect(rows.map(\.id) == [0, 1, 2, 3, 4, 5])
        #expect(rows.map(\.beforeLine) == [1, 2, 3, 4, nil, 5])
        #expect(rows.map(\.afterLine) == [1, nil, 2, 3, 4, 5])
        #expect(try await LineDiff.compare(before: before, after: after) == result)
        expectReconstruction(rows, before: before, after: after)
    }

    @Test func totalUTF8ByteBudgetCountsBothInputs() async throws {
        let source = String(repeating: "é", count: 1_048_576) // 2 MiB in UTF-8
        #expect(try await LineDiff.compare(before: source, after: source) == .identical)
        #expect(try await LineDiff.compare(before: source, after: source + "\n") == .exceedsBudget)
    }

    @Test func totalLineBudgetCountsBothInputsEvenWhenIdentical() async throws {
        let atLimit = String(repeating: "\r\n", count: 6_000)
        #expect(try await LineDiff.compare(before: atLimit, after: atLimit) == .identical)
        #expect(try await LineDiff.compare(before: atLimit, after: atLimit + "\r") == .exceedsBudget)
    }

    @Test func overBudgetMiddleNeverReturnsPartialRows() async throws {
        let before = "頭\n" + String(repeating: "甲\n", count: 1_001) + "尾"
        let after = "頭\n" + String(repeating: "乙\n", count: 1_001) + "尾"
        #expect(try await LineDiff.compare(before: before, after: after) == .exceedsBudget)
    }

    @Test func largeCommonEndsDoNotCountAgainstTheQuadraticBudget() async throws {
        let prefix = String(repeating: "頭\n", count: 1_500)
        let suffix = String(repeating: "尾\r\n", count: 1_500)
        let result = try await LineDiff.compare(before: prefix + "甲\n" + suffix, after: prefix + "乙\n" + suffix)
        let rows = try requireRows(result)

        #expect(rows.count == 3_002)
        #expect(rows.filter { $0.kind == .removed }.map(\.beforeLine) == [1_501])
        #expect(rows.filter { $0.kind == .added }.map(\.afterLine) == [1_501])
    }

    @Test func longLineContentDoesNotMultiplyTheCellBudget() async throws {
        let sharedBytes = String(repeating: "a", count: 1_024)
        let before = String(repeating: sharedBytes + "x\n", count: 1_000)
        let after = String(repeating: sharedBytes + "y\n", count: 1_000)
        let result = try await LineDiff.compare(before: before, after: after)
        let rows = try requireRows(result)

        #expect(rows.count == 2_000)
        #expect(rows.contains { $0.kind == .unchanged } == false)
        expectReconstruction(rows, before: before, after: after)
    }

    @Test func alreadyCancelledTaskThrowsEvenForIdenticalInputs() async {
        let result = await withTaskGroup(of: Bool.self, returning: Bool?.self) { group in
            group.cancelAll()
            group.addTask {
                do {
                    _ = try await LineDiff.compare(before: "同じ", after: "同じ")
                    return false
                } catch is CancellationError {
                    return true
                } catch {
                    Issue.record("Expected CancellationError, got \(error)")
                    return false
                }
            }
            return await group.next()
        }
        #expect(result == true)
    }

    private func requireRows(
        _ result: LineDiff.Result,
        sourceLocation: SourceLocation = #_sourceLocation
    ) throws -> [LineDiff.Row] {
        let rows: [LineDiff.Row]? = if case let .rows(rows) = result { rows } else { nil }
        return try #require(rows, "Expected a complete diff", sourceLocation: sourceLocation)
    }

    private func expectReconstruction(
        _ rows: [LineDiff.Row],
        before: String,
        after: String,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        func source(_ rows: [LineDiff.Row]) -> String {
            rows.map { row in
                let ending = switch row.ending {
                case .none: ""
                case .lf: "\n"
                case .crlf: "\r\n"
                case .cr: "\r"
                }
                return row.text + ending
            }.joined()
        }

        let reconstructedBefore = source(rows.filter { $0.beforeLine != nil })
        let reconstructedAfter = source(rows.filter { $0.afterLine != nil })
        #expect(reconstructedBefore.utf8.elementsEqual(before.utf8), sourceLocation: sourceLocation)
        #expect(reconstructedAfter.utf8.elementsEqual(after.utf8), sourceLocation: sourceLocation)
    }
}
