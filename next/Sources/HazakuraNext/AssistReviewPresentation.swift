import HazakuraNextCore

/// Display only: never use either projection as replacement text.
enum AssistReviewPresentation {
    static func literal(_ text: String) -> String {
        var result = ""
        result.reserveCapacity(text.utf8.count)
        for scalar in text.unicodeScalars {
            switch scalar.value {
            case 0x20: result += #"\s"#
            case 0x09: result += #"\t"#
            case 0x0A: result += #"\n"#
            case 0x0D: result += #"\r"#
            case 0x5C: result += #"\\"#
            case 0x21...0x7E: result.unicodeScalars.append(scalar)
            default:
                if canDisplayAsLiteral(scalar) {
                    result.unicodeScalars.append(scalar)
                } else {
                    result += "\\u{\(hexCode(scalar))}"
                }
            }
        }
        return result
    }

    /// The exact form is independent of grapheme clustering, normalization and font support.
    static func scalarCodes(_ text: String) -> String {
        var result = ""
        for scalar in text.unicodeScalars {
            if !result.isEmpty { result += " " }
            result += "U+\(hexCode(scalar))"
        }
        return result
    }

    static func ending(_ ending: LineDiff.Row.Ending) -> String {
        switch ending {
        case .lf: "LF"
        case .crlf: "CRLF"
        case .cr: "CR"
        case .none: "改行なし"
        }
    }

    private static func hexCode(_ scalar: Unicode.Scalar) -> String {
        let hex = String(scalar.value, radix: 16, uppercase: true)
        return String(repeating: "0", count: max(0, 4 - hex.utf8.count)) + hex
    }

    private static func canDisplayAsLiteral(_ scalar: Unicode.Scalar) -> Bool {
        let properties = scalar.properties
        guard !properties.isBidiControl, !properties.isDefaultIgnorableCodePoint,
              !properties.isWhitespace, !properties.isGraphemeExtend else { return false }
        switch properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
             .decimalNumber, .letterNumber, .otherNumber,
             .connectorPunctuation, .dashPunctuation, .openPunctuation, .closePunctuation,
             .initialPunctuation, .finalPunctuation, .otherPunctuation,
             .mathSymbol, .currencySymbol, .modifierSymbol, .otherSymbol:
            break
        default:
            return false
        }

        // Restrict raw text to known reading ranges: category alone also admits blank and RTL
        // characters. Combining marks and uncertain scalars use exact escapes instead.
        switch scalar.value {
        case 0xFF3C, 0x1F1E6...0x1F1FF: return false // Fullwidth backslash and joinable flag letters.
        case 0x00C0...0x024F, 0x1E00...0x1EFF, // Latin with diacritics and extensions.
             0x3001...0x301F, 0x3040...0x30FF, 0x31F0...0x31FF, 0x1B000...0x1B16F, // Kana and CJK punctuation.
             0xFF01...0xFF5E, 0xFF61...0xFF9F: // Fullwidth ASCII and halfwidth katakana.
            return true
        default:
            return properties.isIdeographic || (properties.isEmojiPresentation && properties.generalCategory == .otherSymbol)
        }
    }
}
