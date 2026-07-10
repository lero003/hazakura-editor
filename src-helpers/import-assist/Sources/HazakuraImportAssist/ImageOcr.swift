import Foundation
import Vision
import AppKit
import ImageIO
#if canImport(PDFKit)
import PDFKit
#endif

func ocrImage(path: String, languages: [String]) throws -> OcrTextValue {
    #if FIXTURE_MODE
    _ = try requireExistingFile(path: path)
    let text = "Fixture OCR text (\(languages.joined(separator: ",")))."
    return OcrTextValue(text: text, confidence: 0.99)
    #else
    let url = try requireExistingFile(path: path)
    let cgImage = try loadCGImage(url: url)
    return try runVisionOcr(cgImage: cgImage, languages: languages)
    #endif
}

/// Render each PDF page to a bitmap and run Vision OCR.
/// Used when the text layer is missing or unusable (scans).
func ocrPdfPages(path: String, languages: [String]) throws -> PdfTextValue {
    #if FIXTURE_MODE
    _ = try requireExistingFile(path: path)
    let pages = [
        PdfPageText(index: 0, text: "Fixture OCR PDF page 1.", charCount: 24),
        PdfPageText(index: 1, text: "Fixture OCR PDF page 2.", charCount: 24),
    ]
    return PdfTextValue(pages: pages, pageCount: pages.count)
    #else
    #if canImport(PDFKit)
    let url = try requireExistingFile(path: path)
    guard let document = PDFDocument(url: url) else {
        throw ImportAssistError.cannotOpenPdf(path)
    }
    var pages: [PdfPageText] = []
    // Cap page count for MVP safety (long scans stay interactive).
    let maxPages = min(document.pageCount, 40)
    for index in 0 ..< maxPages {
        guard let page = document.page(at: index) else {
            pages.append(PdfPageText(index: index, text: "", charCount: 0))
            continue
        }
        let cgImage = try renderPdfPage(page)
        let ocr = try runVisionOcr(cgImage: cgImage, languages: languages)
        pages.append(
            PdfPageText(
                index: index,
                text: ocr.text,
                charCount: ocr.text.count
            )
        )
    }
    return PdfTextValue(pages: pages, pageCount: pages.count)
    #else
    throw ImportAssistError.cannotOpenPdf("PDFKit unavailable on this platform")
    #endif
    #endif
}

#if !FIXTURE_MODE
func loadCGImage(url: URL) throws -> CGImage {
    if let source = CGImageSourceCreateWithURL(url as CFURL, nil),
       let image = CGImageSourceCreateImageAtIndex(source, 0, nil) {
        return image
    }
    guard let nsImage = NSImage(contentsOf: url) else {
        throw ImportAssistError.cannotLoadImage(url.path)
    }
    var rect = NSRect(origin: .zero, size: nsImage.size)
    guard let cgImage = nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw ImportAssistError.cannotLoadImage(url.path)
    }
    return cgImage
}

#if canImport(PDFKit)
/// OCR-oriented page render (~2x media box). Preview/reference rendering
/// uses the sized overload in `PdfReference.swift`.
func renderPdfPage(_ page: PDFPage) throws -> CGImage {
    let bounds = page.bounds(for: .mediaBox)
    // ~150–200 DPI equivalent for body text OCR.
    let scale: CGFloat = 2.0
    let width = max(1, Int(bounds.width * scale))
    let height = max(1, Int(bounds.height * scale))
    return try renderPdfPage(page, width: width, height: height)
}
#endif

func runVisionOcr(cgImage: CGImage, languages: [String]) throws -> OcrTextValue {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if !languages.isEmpty {
        request.recognitionLanguages = languages
    }
    // Prefer reading order closer to top-to-bottom for notes / memos.
    if #available(macOS 13.0, *) {
        request.automaticallyDetectsLanguage = true
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        throw ImportAssistError.ocrFailed(error.localizedDescription)
    }

    let observations = request.results ?? []
    // Sort by vertical position (top → bottom), then left → right.
    let sorted = observations.sorted { a, b in
        let ra = a.boundingBox
        let rb = b.boundingBox
        if abs(ra.maxY - rb.maxY) > 0.01 {
            return ra.maxY > rb.maxY
        }
        return ra.minX < rb.minX
    }

    var lines: [String] = []
    var confidenceSum: Float = 0
    var confidenceCount = 0
    for observation in sorted {
        guard let candidate = observation.topCandidates(1).first else {
            continue
        }
        lines.append(candidate.string)
        confidenceSum += candidate.confidence
        confidenceCount += 1
    }
    let text = lines.joined(separator: "\n")
    let confidence =
        confidenceCount == 0
            ? 0.0
            : Double(confidenceSum / Float(confidenceCount))
    return OcrTextValue(text: text, confidence: confidence)
}
#endif
