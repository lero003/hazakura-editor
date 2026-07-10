import Foundation
import AppKit
#if canImport(PDFKit)
import PDFKit
#endif

// v1.7 R0 — PDF reference info + one-page bounded raster.
//
// Requests:
//   {"action":"pdf_info","path":"/abs/file.pdf"}
//   {"action":"render_pdf_page","path":"/abs/file.pdf","page":0,"maxPixels":4000000}
//
// Responses:
//   kind: pdf_info | pdf_page_image | error

struct PdfInfoValue: Encodable {
    let pageCount: Int
    let fileName: String
}

struct PdfPageImageValue: Encodable {
    let page: Int
    let width: Int
    let height: Int
    let mime: String
    let dataBase64: String
}

/// Default and hard ceiling for rendered page pixel count (width * height).
let defaultPdfRenderMaxPixels = 4_000_000
let absolutePdfRenderMaxPixels = 4_000_000

func pdfInfo(path: String) throws -> PdfInfoValue {
    #if FIXTURE_MODE
    let url = try requireExistingFile(path: path)
    return PdfInfoValue(
        pageCount: 2,
        fileName: url.lastPathComponent
    )
    #else
    #if canImport(PDFKit)
    let url = try requireExistingFile(path: path)
    guard let document = PDFDocument(url: url) else {
        throw ImportAssistError.cannotOpenPdf(path)
    }
    guard document.pageCount > 0 else {
        throw ImportAssistError.cannotOpenPdf("PDF has no pages: \(path)")
    }
    return PdfInfoValue(
        pageCount: document.pageCount,
        fileName: url.lastPathComponent
    )
    #else
    throw ImportAssistError.cannotOpenPdf("PDFKit unavailable on this platform")
    #endif
    #endif
}

func renderPdfPageImage(path: String, page: Int, maxPixels: Int?) throws -> PdfPageImageValue {
    let cappedMax = clampMaxPixels(maxPixels)
    #if FIXTURE_MODE
    _ = try requireExistingFile(path: path)
    if page < 0 || page > 1 {
        throw ImportAssistError.cannotOpenPdf("PDF page index out of range: \(page)")
    }
    // 2x2 solid PNG fixture (tiny, valid).
    let pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"
    return PdfPageImageValue(
        page: page,
        width: 2,
        height: 2,
        mime: "image/png",
        dataBase64: pngBase64
    )
    #else
    #if canImport(PDFKit)
    let url = try requireExistingFile(path: path)
    guard let document = PDFDocument(url: url) else {
        throw ImportAssistError.cannotOpenPdf(path)
    }
    guard page >= 0, page < document.pageCount, let pdfPage = document.page(at: page) else {
        throw ImportAssistError.cannotOpenPdf("PDF page index out of range: \(page)")
    }
    let bounds = pdfPage.bounds(for: .mediaBox)
    let mediaW = max(1.0, Double(bounds.width))
    let mediaH = max(1.0, Double(bounds.height))
    let scale = scaleToFitPixels(width: mediaW, height: mediaH, maxPixels: cappedMax)
    let width = max(1, Int((mediaW * scale).rounded(.down)))
    let height = max(1, Int((mediaH * scale).rounded(.down)))
    let cgImage = try renderPdfPage(pdfPage, width: width, height: height)
    let pngData = try encodePng(cgImage: cgImage)
    return PdfPageImageValue(
        page: page,
        width: width,
        height: height,
        mime: "image/png",
        dataBase64: pngData.base64EncodedString()
    )
    #else
    throw ImportAssistError.cannotOpenPdf("PDFKit unavailable on this platform")
    #endif
    #endif
}

func clampMaxPixels(_ requested: Int?) -> Int {
    let value = requested ?? defaultPdfRenderMaxPixels
    if value <= 0 {
        return defaultPdfRenderMaxPixels
    }
    return min(value, absolutePdfRenderMaxPixels)
}

func scaleToFitPixels(width: Double, height: Double, maxPixels: Int) -> Double {
    let area = width * height
    let budget = Double(max(1, maxPixels))
    if area <= budget {
        // Prefer a readable preview scale, still within the budget.
        let preferred = 2.0
        if area * preferred * preferred <= budget {
            return preferred
        }
        return sqrt(budget / area)
    }
    return sqrt(budget / area)
}

#if canImport(PDFKit) && !FIXTURE_MODE
func renderPdfPage(_ page: PDFPage, width: Int, height: Int) throws -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw ImportAssistError.ocrFailed("Cannot create bitmap context for PDF page.")
    }
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let bounds = page.bounds(for: .mediaBox)
    let scaleX = CGFloat(width) / max(1, bounds.width)
    let scaleY = CGFloat(height) / max(1, bounds.height)
    ctx.saveGState()
    ctx.scaleBy(x: scaleX, y: scaleY)
    page.draw(with: .mediaBox, to: ctx)
    ctx.restoreGState()
    guard let image = ctx.makeImage() else {
        throw ImportAssistError.ocrFailed("Cannot render PDF page image.")
    }
    return image
}

func encodePng(cgImage: CGImage) throws -> Data {
    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw ImportAssistError.ocrFailed("Cannot encode PDF page as PNG.")
    }
    return data
}
#endif
