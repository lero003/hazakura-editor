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
        let text = document.page(at: index)?.string ?? ""
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
