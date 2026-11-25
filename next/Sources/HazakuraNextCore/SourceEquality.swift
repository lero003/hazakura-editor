import Darwin

/// Exact source equality, without Swift String's canonical-equivalence comparison.
package enum SourceEquality {
    package static func matches(_ lhs: String, _ rhs: String) -> Bool {
        guard lhs.isContiguousUTF8, rhs.isContiguousUTF8 else {
            // AppKit can provide a bridged string. For valid Swift strings, equal UTF-16
            // units imply equal UTF-8 bytes, without forcing either input into UTF-8 storage.
            return lhs.utf16.elementsEqual(rhs.utf16)
        }
        var lhs = lhs
        var rhs = rhs
        return lhs.withUTF8 { left in
            rhs.withUTF8 { right in
                guard left.count == right.count else { return false }
                if left.isEmpty { return true }
                guard let a = left.baseAddress, let b = right.baseAddress else { return false }
                return memcmp(a, b, left.count) == 0
            }
        }
    }
}
