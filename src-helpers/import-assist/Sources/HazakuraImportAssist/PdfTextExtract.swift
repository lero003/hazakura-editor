import Foundation
#if canImport(PDFKit)
import PDFKit
#endif

enum ImportAssistError: LocalizedError {
    case fileNotFound(String)
    case notAFile(String)
    case cannotOpenPdf(String)
    case cannotLoadImage(String)
    case ocrFailed(String)

    var errorDescription: String? {
        switch self {
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .notAFile(let path):
            return "Not a regular file: \(path)"
        case .cannotOpenPdf(let path):
            return "Cannot open PDF: \(path)"
        case .cannotLoadImage(let path):
            return "Cannot load image: \(path)"
        case .ocrFailed(let message):
            return "OCR failed: \(message)"
        }
    }
}

func requireExistingFile(path: String) throws -> URL {
    let url = URL(fileURLWithPath: path)
    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) else {
        throw ImportAssistError.fileNotFound(path)
    }
    if isDir.boolValue {
        throw ImportAssistError.notAFile(path)
    }
    return url
}

func extractPdfText(path: String) throws -> PdfTextValue {
    #if FIXTURE_MODE
    _ = try requireExistingFile(path: path)
    let pages = [
        PdfPageText(
            index: 0,
            text: "Fixture PDF page 1 text.",
            charCount: "Fixture PDF page 1 text.".count
        ),
        PdfPageText(
            index: 1,
            text: "Fixture PDF page 2 text.",
            charCount: "Fixture PDF page 2 text.".count
        ),
    ]
    return PdfTextValue(pages: pages, pageCount: pages.count)
    #else
    #if canImport(PDFKit)
    let url = try requireExistingFile(path: path)
    guard let document = PDFDocument(url: url) else {
        throw ImportAssistError.cannotOpenPdf(path)
    }
    var pages: [PdfPageText] = []
    for index in 0 ..< document.pageCount {
        let text = extractPageText(document.page(at: index))
        pages.append(
            PdfPageText(
                index: index,
                text: text,
                charCount: text.count
            )
        )
    }
    return PdfTextValue(pages: pages, pageCount: pages.count)
    #else
    throw ImportAssistError.cannotOpenPdf("PDFKit unavailable on this platform")
    #endif
    #endif
}

#if canImport(PDFKit) && !FIXTURE_MODE
/// Prefer several PDFKit text APIs — some text-layer PDFs return empty
/// from `page.string` alone (CID fonts, odd encodings) but still expose
/// text via selection / attributed string.
func extractPageText(_ page: PDFPage?) -> String {
    guard let page else { return "" }
    if let s = page.string?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
        return page.string ?? s
    }
    if let attributed = page.attributedString?.string,
       !attributed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return attributed
    }
    let bounds = page.bounds(for: .mediaBox)
    if let selection = page.selection(for: bounds),
       let s = selection.string,
       !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return s
    }
    return page.string ?? ""
}
#endif
