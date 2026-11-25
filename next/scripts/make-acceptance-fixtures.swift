import Foundation

private func createPrivateDirectory(at url: URL) throws {
    try url.withUnsafeFileSystemRepresentation { path in
        guard let path else { throw POSIXError(.EINVAL) }
        // mkdir fails if the name already exists and sets the mode at creation.
        guard mkdir(path, 0o700) == 0 else {
            throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
        }
    }
}

private func makeFixtures() -> [(name: String, bytes: Data)] {
    let firstReading = """
        # 川辺の手帖

        朝の川辺を歩くと、水面に細い光が伸びていた。
        橋の下にはまだ夜の冷たさが残っている。

        ## 窓辺

        川に向いた窓を開ける。机には **青いノート** と短い鉛筆。

        > 風の音が止んでから、次の行を書く。

        - 水面の色を一行で記す。
        - 見上げた空の色をもう一行で記す。

        文字の見本：cafe\u{0301} と 🌸。
        [参照先の見本](https://example.invalid/reading)

        ## 橋を渡る

        橋の真ん中で立ち止まる。欄干の影が川の流れと重なる。

        土手の階段を上り、角の店先でひと息つく。
        開店前の看板が、通りを照らすように傾いていた。

        ## 窓辺

        帰宅して同じ窓を開けると、橋の向こうが夕焼けに染まっていた。

        桜のしおりを、閉じかけた手帖にはさんだ。

        第一原稿の末尾。
        """

    let secondReading = """
        # 丘の手帖

        丘へ続く道を歩くと、低い石垣の先に小さな庭が見えた。
        道沿いの木々には、雨上がりのしずくが残っている。

        ## 窓辺

        坂の途中の窓から、かすかにお茶の香りが届く。
        ベンチに座り、ほどけた靴ひもを結び直した。

        文字の見本：cafe\u{0301} と 🍵。

        ## 庭をめぐる

        花壇のそばでは、ひときわ低い草が風に揺れている。

        - 見つけた花の数を記す。
        - 石畳の色を記す。

        帰り道は、来た道と反対側の小さな門から出ることにした。

        ## 窓辺

        遠くの窓に明かりがともり、庭の輪郭が少しずつ夜に溶けていく。

        桜のしおりを、庭で書いたページにはさんだ。

        第二原稿の末尾。
        """

    let mixedLines = "一行目（CR）\r二行目（LF）\n三行目（CRLF）\r\n四行目（改行なし）：e\u{0301} 🍡"
    var utf16BE = Data([0xFE, 0xFF])
    for codeUnit in mixedLines.utf16 {
        utf16BE.append(UInt8(codeUnit >> 8))
        utf16BE.append(UInt8(truncatingIfNeeded: codeUnit))
    }

    // Editor benchmark only: long Japanese lines, with an identifiable final line.
    let repeatedText = String(repeating: "花びらが水面を渡り、ゆるやかな波が岸辺へ届く。", count: 28)
    let longLines = (1...192).map { "長文 \($0)：\(repeatedText)" }
    let longText = (["# 長文の折り返し試験", ""] + longLines + ["長文の終点"]).joined(separator: "\n")

    return [
        ("01-reading.md", Data((firstReading + "\n").utf8)),
        ("02-reading.md", Data((secondReading + "\n").utf8)),
        ("03-encoding.txt", utf16BE),
        ("04-long.md", Data(longText.utf8)),
    ]
}

private func canonicalTemporaryDirectory() throws -> URL {
    try FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
        guard let path else { throw POSIXError(.EINVAL) }
        // On macOS, Foundation URL standardization can retain a /var alias.
        guard let resolved = realpath(path, nil) else {
            throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
        }
        defer { free(resolved) }
        return URL(fileURLWithPath: String(cString: resolved), isDirectory: true)
    }
}

private func generate() throws -> URL {
    let temp = try canonicalTemporaryDirectory()
    let root = temp.appendingPathComponent("hazakura-acceptance-\(UUID().uuidString)", isDirectory: true)
    let fixtures = makeFixtures()

    // This standalone process should create 0700 directories even with a stricter inherited umask.
    let oldMask = umask(0o077)
    defer { _ = umask(oldMask) }
    try createPrivateDirectory(at: root)
    for lane in ["first", "next"] {
        let folder = root.appendingPathComponent(lane, isDirectory: true)
        try createPrivateDirectory(at: folder)
        for (name, bytes) in fixtures {
            try bytes.write(to: folder.appendingPathComponent(name), options: .withoutOverwriting)
        }
    }
    return root
}

guard CommandLine.arguments.count == 1 else {
    FileHandle.standardError.write(Data("This script takes no arguments.\n".utf8))
    exit(2)
}

do {
    print(try generate().path)
} catch {
    FileHandle.standardError.write(Data("Could not create acceptance fixtures: \(error)\n".utf8))
    exit(1)
}
