import Foundation

// JSON-over-stdio dispatch for Import Assist spike.
//
// Requests (one JSON object per line):
//   {"action":"probe"}
//   {"action":"extract_pdf_text","path":"/abs/file.pdf"}
//   {"action":"ocr_image","path":"/abs/image.png","languages":["ja-JP","en-US"]}
//
// Responses (one JSON object per line), top-level "kind":
//   probe | pdf_text | ocr_text | error

enum WireEnvelope: Encodable {
    case probe(ProbeValue)
    case pdfText(PdfTextValue)
    case ocrText(OcrTextValue)
    case error(ErrorValue)

    private enum CodingKeys: String, CodingKey {
        case kind, value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .probe(let value):
            try container.encode("probe", forKey: .kind)
            try container.encode(value, forKey: .value)
        case .pdfText(let value):
            try container.encode("pdf_text", forKey: .kind)
            try container.encode(value, forKey: .value)
        case .ocrText(let value):
            try container.encode("ocr_text", forKey: .kind)
            try container.encode(value, forKey: .value)
        case .error(let value):
            try container.encode("error", forKey: .kind)
            try container.encode(value, forKey: .value)
        }
    }
}

struct ProbeValue: Encodable {
    let pdfKit: Bool
    let vision: Bool
    let fixture: Bool
}

struct PdfPageText: Encodable {
    let index: Int
    let text: String
    let charCount: Int
}

struct PdfTextValue: Encodable {
    let pages: [PdfPageText]
    let pageCount: Int
}

struct OcrTextValue: Encodable {
    let text: String
    let confidence: Double
}

struct ErrorValue: Encodable {
    let error: String
    let kind: String
}

struct IncomingRequest: Decodable {
    let action: String
    let path: String?
    let languages: [String]?
}

func emit(_ envelope: WireEnvelope) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    guard let data = try? encoder.encode(envelope),
          let line = String(data: data, encoding: .utf8) else {
        FileHandle.standardError.write(
            Data("hazakura-import-assist-helper: failed to encode response\n".utf8)
        )
        return
    }
    print(line)
    fflush(stdout)
}

func emitError(_ message: String, kind: String = "failed") {
    emit(.error(ErrorValue(error: message, kind: kind)))
}

func dispatch(_ raw: String) {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return
    }
    guard let data = trimmed.data(using: .utf8) else {
        emitError("Request is not valid UTF-8.", kind: "invalid_request")
        return
    }
    let request: IncomingRequest
    do {
        request = try JSONDecoder().decode(IncomingRequest.self, from: data)
    } catch {
        emitError("Malformed JSON request.", kind: "invalid_request")
        return
    }

    switch request.action {
    case "probe":
        #if FIXTURE_MODE
        emit(.probe(ProbeValue(pdfKit: true, vision: true, fixture: true)))
        #else
        emit(.probe(ProbeValue(pdfKit: true, vision: true, fixture: false)))
        #endif
    case "extract_pdf_text":
        guard let path = request.path, !path.isEmpty else {
            emitError("path is required for extract_pdf_text.", kind: "invalid_request")
            return
        }
        do {
            let value = try extractPdfText(path: path)
            emit(.pdfText(value))
        } catch {
            emitError(error.localizedDescription, kind: "pdf_extract_failed")
        }
    case "ocr_image":
        guard let path = request.path, !path.isEmpty else {
            emitError("path is required for ocr_image.", kind: "invalid_request")
            return
        }
        let languages = request.languages ?? ["ja-JP", "en-US"]
        do {
            let value = try ocrImage(path: path, languages: languages)
            emit(.ocrText(value))
        } catch {
            emitError(error.localizedDescription, kind: "ocr_failed")
        }
    default:
        emitError("Unknown action: \(request.action)", kind: "invalid_request")
    }
}

// Line-oriented stdin loop. EOF ends cleanly.
while let line = readLine(strippingNewline: false) {
    dispatch(line)
}
