import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import PDFKit
import Testing

@MainActor
@Suite(.serialized)
struct MarkdownPDFExportTests {
    // Exercise one detached WKWebView capture at a time, as in the workspace UI.
    // No app window, file picker, external viewer or output file.
    @Test func capturesWholeFlowWithoutExportingActiveReferences() async throws {
        let source = "# StartMarker\n\n"
            + "[LinkLabel](https://example.invalid/pdf-target) ![ImageLabel](file:///never-read-pdf-fixture)\n\n"
            + "<script>authorScriptMarker</script>\n\n"
            + "| TableHeaderMarker | Other |\n| --- | --- |\n| [TableCellMarker](https://example.invalid/table-target) | `&` |\n\n"
            + String(repeating: "Body paragraph\n\n", count: 275)
            + "```text\n" + String(repeating: "幅", count: 150) + "\nCodeEndMarker\n```\n\n"
            + "## EndMarker 末尾の日本語"
        let data = try await MarkdownPDFExport.render(source: source)
        let document = try #require(PDFDocument(data: data))
        #expect(document.pageCount == 1)
        let page = try #require(document.page(at: 0))
        let text = try #require(page.string)
        for label in ["StartMarker", "LinkLabel", "ImageLabel", "TableHeaderMarker", "TableCellMarker", "CodeEndMarker", "EndMarker"] {
            #expect(text.contains(label))
        }
        // PDFKit can extract the same glyph as the Unicode Kangxi radical (e.g. ⽇).
        #expect(text.precomposedStringWithCompatibilityMapping.contains("末尾の日本語"))
        for dropped in ["pdf-target", "table-target", "never-read-pdf-fixture", "authorScriptMarker"] {
            #expect(!text.contains(dropped))
        }
        #expect(page.annotations.isEmpty)
        let bounds = page.bounds(for: .mediaBox)
        #expect(bounds.width == 720)
        #expect(bounds.height > 8_000 && bounds.height <= 12_000)
    }

    @Test func refusesLongFlowRatherThanReturningACroppedPDF() async {
        let source = String(repeating: "Body paragraph\n\n", count: 500) + "EndMarker"
        await #expect(throws: MarkdownPDFExportError.documentTooLarge) {
            try await MarkdownPDFExport.render(source: source)
        }
    }

    @Test func refusesOrderedMarkerThatMayOverflowLeftOfThePage() async {
        await #expect(throws: MarkdownPDFExportError.documentTooLarge) {
            try await MarkdownPDFExport.render(source: "123456789. Long ordinal")
        }
    }

    @Test func rejectsUnusableOrExcessiveLayoutBeforeCapture() throws {
        for value in [Double.nan, .infinity, -.infinity, -1, 0] {
            #expect(throws: MarkdownPDFExportError.renderingFailed) {
                try MarkdownPDFExport.captureRect(width: value, height: 160)
            }
            #expect(throws: MarkdownPDFExportError.renderingFailed) {
                try MarkdownPDFExport.captureRect(width: 720, height: value)
            }
        }
        #expect(throws: MarkdownPDFExportError.documentTooLarge) {
            try MarkdownPDFExport.captureRect(width: 720.01, height: 160)
        }
        #expect(throws: MarkdownPDFExportError.documentTooLarge) {
            try MarkdownPDFExport.captureRect(width: 720, height: 11_999)
        }
        let maximum = try MarkdownPDFExport.captureRect(width: 720, height: 11_997.5)
        #expect(maximum.size == CGSize(width: 720, height: 12_000))
    }

    @Test func refusesPDFOverTheWriterBudgetAndMissingNativePDFSignature() throws {
        let limit = SelectedTextCopyWriter.pdfByteLimit
        var bytes = Data("%PDF-".utf8)
        bytes.append(Data(count: limit - bytes.count))
        try MarkdownPDFExport.validateByteEnvelope(bytes)
        bytes.append(0)
        #expect(throws: MarkdownPDFExportError.pdfTooLarge) {
            try MarkdownPDFExport.validateByteEnvelope(bytes)
        }
        #expect(throws: MarkdownPDFExportError.renderingFailed) {
            try MarkdownPDFExport.validateByteEnvelope(Data("not a PDF".utf8))
        }
    }

    @Test func cancellingAfterWebKitNavigationStartsPreventsPDFPublication() async throws {
        let session = WorkspaceSession(source: "# 合成原稿\n\n桜")
        session.requestExport(.pdf)
        let id = try #require(session.exportRequest?.id)
        var capturedCancellation = false
        await session.writeRequestedExport(id, to: URL(fileURLWithPath: "/synthetic/cancelled.pdf"), using: .init(
            renderPDF: { source in
                do {
                    return try await MarkdownPDFExport.render(source: source, didStartCapture: {
                        #expect(session.cancellableExportRenderID == id)
                        session.cancelExportRendering(id)
                        #expect(session.isFinishingCancelledExport && session.isBusy)
                    })
                } catch is CancellationError {
                    #expect(Task.isCancelled)
                    capturedCancellation = true
                    throw CancellationError()
                }
            },
            writePDF: { _, _ in Issue.record("A cancelled capture must not reach publication.") }
        ))
        #expect(capturedCancellation)
        #expect(!session.isBusy && session.canExport)
        #expect(session.fileNotice == nil)
    }

    @Test func propagatesProjectionLimitsAndCancellation() async {
        let source = String(repeating: "a", count: 128 * 1024 + 1)
        await #expect(throws: MarkdownHTMLExport.ExportError.unavailable(.inputTooLarge)) {
            try await MarkdownPDFExport.render(source: source)
        }
        await withThrowingTaskGroup(of: Data.self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownPDFExport.render(source: "# Cancelled") }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }
}
