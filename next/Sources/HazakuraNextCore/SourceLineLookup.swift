package enum SourceLineLookup {
    /// Returns the zero-based UTF-16 offset at the start of a one-based source line.
    /// Like Markdown preview source mapping, only LF, CR, and CRLF end a line.
    /// Other whitespace and Unicode separators (such as U+2028) do not split lines.
    /// CRLF counts as one terminator, and offsets never split a surrogate pair.
    /// Line 1 exists even in an empty source; a trailing terminator adds an empty line.
    /// Returns `nil` for nonpositive line numbers or lines past the end of the source.
    package static func utf16Offset(of oneBasedLine: Int, in source: String) -> Int? {
        guard oneBasedLine > 0 else { return nil }
        if oneBasedLine == 1 { return 0 }

        var remainingBreaks = oneBasedLine - 1
        var offset = 0
        let units = source.utf16
        let end = units.endIndex
        var cursor = units.startIndex
        while cursor != end {
            let unit = units[cursor]
            units.formIndex(after: &cursor)
            offset += 1

            guard unit == 0x0D || unit == 0x0A else { continue }
            if unit == 0x0D, cursor != end, units[cursor] == 0x0A {
                units.formIndex(after: &cursor)
                offset += 1
            }
            remainingBreaks -= 1
            if remainingBreaks == 0 { return offset }
        }
        return nil
    }
}
