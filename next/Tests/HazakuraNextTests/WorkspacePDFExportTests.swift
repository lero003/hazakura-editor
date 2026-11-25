import Darwin
import Foundation
@testable import HazakuraNext
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspacePDFExportTests {
    @Test func pdfRequestKeepsItsFormatAndWritesExactBytes() async throws {
        let canonical = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let base = try #require(canonical)
        defer { free(base) }
        let folder = URL(fileURLWithPath: String(cString: base), isDirectory: true)
            .appending(path: "hazakura-pdf-workspace-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let destination = folder.appending(path: "書き出し.PDF")

        let committed = "# か\u{3099}\r\n本文"
        let session = WorkspaceSession(source: committed)
        let documentID = try #require(session.tabs.selectedID)
        let revision = try #require(session.tabs.selectedTab?.document.revision)
        let payload = Data("%PDF-1.7\n%".utf8) + Data([0xC2, 0xFF, 0x00]) + Data("\n%%EOF\n".utf8)

        session.requestExport(.pdf)
        let request = try #require(session.exportRequest)
        #expect(session.canExport == false)
        session.requestExport(.html)
        #expect(session.exportRequest?.id == request.id)
        #expect(session.exportRequest?.format == .pdf)

        await session.writeRequestedExport(request.id, to: destination, using: .init(
            renderHTML: unexpectedHTML,
            renderPDF: { source in
                #expect(source.utf8.elementsEqual(committed.utf8))
                return payload
            }
        ))

        #expect(try Data(contentsOf: destination) == payload)
        #expect(session.fileNotice?.contains("PDFを書き出しました") == true)
        #expect(session.canExport)
        #expect(session.exportRequest == nil)
        #expect(session.tabs.selectedID == documentID)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDrafts.isEmpty)
    }

    @Test(arguments: [WorkspaceSession.ExportFormat.html, .pdf])
    func rejectsTheOtherFormatsExtensionBeforeGeneration(_ format: WorkspaceSession.ExportFormat) async throws {
        let session = WorkspaceSession(source: "# 原稿")
        session.requestExport(format)
        let request = try #require(session.exportRequest?.id)
        let destination = URL(fileURLWithPath: format == .html ? "/synthetic/export.pdf" : "/synthetic/export.html")
        await session.writeRequestedExport(request, to: destination, using: .init(
            renderHTML: unexpectedHTML,
            renderPDF: { _ in
                Issue.record("A mismatched extension cannot start PDF generation.")
                throw CancellationError()
            }
        ))
        #expect(session.exportRequest == nil)
        #expect(session.fileNotice?.contains(format == .html ? ".html" : ".pdf") == true)
    }

    @Test func aPDFResultIsRejectedWhenTheRevisionChangesDuringGeneration() async throws {
        let session = WorkspaceSession(source: "# 原稿")
        let documentID = try #require(session.tabs.selectedID)
        session.requestExport(.pdf)
        let request = try #require(session.exportRequest?.id)
        let destination = URL(fileURLWithPath: "/synthetic/export.pdf")
        let suspension = ExportSuspension()
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                await session.writeRequestedExport(request, to: destination, using: .init(
                    renderHTML: unexpectedHTML,
                    renderPDF: { _ in
                        await suspension.pause()
                        return Data("%PDF-1.7\n%%EOF".utf8)
                    },
                    writePDF: { _, _ in Issue.record("An obsolete PDF must not reach the writer.") }
                ))
                suspension.resume()
            }
            await suspension.waitForPause()
            #expect(session.exportRequest?.id == request)
            session.applyCommittedSource("# 更新後", to: documentID)
            suspension.resume()
        }
        #expect(session.exportRequest == nil)
        #expect(session.fileNotice?.contains("原稿の状態が変わったため、PDFを書き出していません") == true)
        #expect(session.tabs.selectedTab?.document.source == "# 更新後")
    }
}

private func unexpectedHTML(_ source: String) async throws -> String {
    Issue.record("Unexpected HTML generation.")
    throw CancellationError()
}
