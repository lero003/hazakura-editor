import Foundation

// `main.swift` is the JSON-over-stdio dispatch loop.
//
// Wire protocol:
//   * Input: one JSON request per line on stdin. Two shapes are
//     accepted, distinguished by the top-level `"action"` key:
//       { "action": "probe_availability" }
//       { "action": "generate_candidate", "operation": "...",
//         "actionId": "...", "selectedText": "...",
//         "documentContext": "...", "additionalRequest": "..." }
//   * Output: one JSON response per line on stdout. Each response
//     also has a top-level discriminant `"kind"`:
//       { "kind": "availability", "value": { ... } }
//       { "kind": "candidate",    "value": { ... } }
//       { "kind": "error",        "value": { "error": "...", "kind": "..." } }
//   * stderr is reserved for log lines only and is NEVER parsed
//     by the Rust supervisor.
//
// EOF on stdin terminates the helper cleanly with exit code 0.
// A malformed JSON request returns an error envelope but does
// NOT terminate the helper — the Rust supervisor may reuse the
// helper for subsequent requests.

enum WireEnvelope: Encodable {
    case availability(AppleAssistAvailabilityResponse)
    case candidate(AppleAssistResponse)
    case error(AppleAssistErrorEnvelope)

    private enum CodingKeys: String, CodingKey {
        case kind, value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .availability(let value):
            try container.encode("availability", forKey: .kind)
            try container.encode(value, forKey: .value)
        case .candidate(let value):
            try container.encode("candidate", forKey: .kind)
            try container.encode(value, forKey: .value)
        case .error(let value):
            try container.encode("error", forKey: .kind)
            try container.encode(value, forKey: .value)
        }
    }
}

struct IncomingRequest: Decodable {
    let action: String
    let operation: String?
    let actionId: String?
    let selectedText: String?
    let documentContext: String?
    let instruction: String?
    let additionalRequest: String?
}

func emit(_ envelope: WireEnvelope) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    guard let data = try? encoder.encode(envelope),
          let line = String(data: data, encoding: .utf8) else {
        FileHandle.standardError.write(
            Data("hazakura-apple-assist-helper: failed to encode response\n"
                .utf8)
        )
        return
    }
    print(line)
    fflush(stdout)
}

func dispatch(_ raw: String) async {
    guard let data = raw.data(using: .utf8) else {
        emit(.error(
            AppleAssistErrorEnvelope(
                error: "Request was not valid UTF-8",
                kind: "validation"
            )
        ))
        return
    }

    let decoder = JSONDecoder()
    guard let request = try? decoder.decode(IncomingRequest.self, from: data) else {
        emit(.error(
            AppleAssistErrorEnvelope(
                error: "Failed to decode request envelope",
                kind: "validation"
            )
        ))
        return
    }

    switch request.action {
    case "probe_availability":
        emit(.availability(AvailabilityProbe.probe()))
    case "generate_candidate":
        guard let operation = request.operation,
              let selectedText = request.selectedText else {
            emit(.error(
                AppleAssistErrorEnvelope(
                    error:
                        "generate_candidate requires `operation` and `selectedText`",
                    kind: "validation"
                )
            ))
            return
        }
        let req = AppleAssistRequest(
            operation: operation,
            actionId: request.actionId,
            selectedText: selectedText,
            documentContext: request.documentContext,
            instruction: request.instruction,
            additionalRequest: request.additionalRequest
        )
        switch await GenerateCandidate.run(req) {
        case .ok(let response):
            emit(.candidate(response))
        case .error(let envelope):
            emit(.error(envelope))
        }
    default:
        emit(.error(
            AppleAssistErrorEnvelope(
                error: "Unknown action: \(request.action)",
                kind: "validation"
            )
        ))
    }
}

while let line = readLine(strippingNewline: true) {
    await dispatch(line)
}
