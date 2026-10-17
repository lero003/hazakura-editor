// Runtime-only, self-authored fixtures. macOS supplies the fonts; no font asset
// or generated PDF is tracked or redistributed by this repository.
import AppKit
import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2 else {
    fatalError("Usage: generate-pdfkit-cases.swift output-directory")
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let pageRect = CGRect(x: 0, y: 0, width: 600, height: 800)

func drawLines(_ lines: [String], in context: CGContext, scale: CGFloat = 1) {
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "ArialUnicodeMS", size: 18 * scale) ?? NSFont.systemFont(ofSize: 18 * scale),
        .foregroundColor: NSColor.black,
    ]
    for (index, line) in lines.enumerated() {
        (line as NSString).draw(
            at: NSPoint(x: 50 * scale, y: (740 - CGFloat(index) * 36) * scale),
            withAttributes: attributes
        )
    }
    NSGraphicsContext.restoreGraphicsState()
}

func writePDF(_ name: String, pages: [[String]], encrypted: Bool = false) {
    var bounds = pageRect
    let metadata: [CFString: Any] = encrypted ? [
        kCGPDFContextUserPassword: "fixture-password",
        kCGPDFContextOwnerPassword: "fixture-owner",
    ] : [:]
    guard let context = CGContext(
        directory.appendingPathComponent(name + ".pdf") as CFURL,
        mediaBox: &bounds,
        metadata as CFDictionary
    ) else { fatalError("Cannot create PDF fixture: \(name)") }
    for lines in pages {
        context.beginPDFPage(nil)
        drawLines(lines, in: context)
        context.endPDFPage()
    }
    context.closePDF()
}

writePDF("english-native", pages: [[
    "Hazakura PDF import fixture.",
    "English punctuation: comma, period.",
    "The source remains unchanged.",
]])
writePDF("japanese-native", pages: [[
    "葉桜の日本語テキスト。",
    "句読点、英数字123を確認する。",
    "原稿は変更しない。",
]])
writePDF("mixed-native", pages: [
    ["第1頁 First page.", "日本語とEnglish 123。"],
    [],
    ["第3頁 Third page.", "終わり End."],
])
writePDF("empty-native", pages: [[]])
writePDF("encrypted-native", pages: [["Private fixture requiring a password."]], encrypted: true)
try Data("%PDF-1.4\nnot a valid PDF\n".utf8)
    .write(to: directory.appendingPathComponent("malformed-native.pdf"))

// Rasterize separately, then put only the bitmap into the scan PDF. This gives
// Vision actual pixels while ensuring PDFKit cannot obtain a text layer.
guard let bitmap = CGContext(
    data: nil, width: 1200, height: 1600, bitsPerComponent: 8,
    bytesPerRow: 1200 * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("Cannot create scan bitmap") }
bitmap.setFillColor(CGColor(gray: 1, alpha: 1))
bitmap.fill(CGRect(x: 0, y: 0, width: 1200, height: 1600))
drawLines(["SCAN IMAGE ONLY", "画像の文字を読む。", "Source remains unchanged."], in: bitmap, scale: 2)
guard let image = bitmap.makeImage() else { fatalError("Cannot capture scan bitmap") }
var bounds = pageRect
guard let scan = CGContext(
    directory.appendingPathComponent("scan-native.pdf") as CFURL,
    mediaBox: &bounds, nil
) else { fatalError("Cannot create scan PDF") }
scan.beginPDFPage(nil)
scan.draw(image, in: pageRect)
scan.endPDFPage()
scan.closePDF()
print("Generated 7 runtime-only PDFKit/Vision fixtures, including Japanese text and image-only scan.")
