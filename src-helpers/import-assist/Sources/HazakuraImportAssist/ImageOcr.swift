import Foundation
import Vision
import AppKit

func ocrImage(path: String, languages: [String]) throws -> OcrTextValue {
    #if FIXTURE_MODE
    _ = try requireExistingFile(path: path)
    let text = "Fixture OCR text (\(languages.joined(separator: ",")))."
    return OcrTextValue(text: text, confidence: 0.99)
    #else
    let url = try requireExistingFile(path: path)
    guard let image = NSImage(contentsOf: url) else {
        throw ImportAssistError.cannotLoadImage(path)
    }
    var rect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw ImportAssistError.cannotLoadImage(path)
    }
    return try runVisionOcr(cgImage: cgImage, languages: languages)
    #endif
}

#if !FIXTURE_MODE
func runVisionOcr(cgImage: CGImage, languages: [String]) throws -> OcrTextValue {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if !languages.isEmpty {
        request.recognitionLanguages = languages
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        throw ImportAssistError.ocrFailed(error.localizedDescription)
    }

    let observations = request.results ?? []
    var lines: [String] = []
    var confidenceSum: Float = 0
    var confidenceCount = 0
    for observation in observations {
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
