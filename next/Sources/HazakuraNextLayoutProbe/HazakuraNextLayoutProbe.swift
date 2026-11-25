import Foundation

@main
struct HazakuraNextLayoutProbe {
    @MainActor static func main() {
        guard LayoutProbeCommand.accepts(Array(CommandLine.arguments.dropFirst())) else {
            FileHandle.standardError.write(Data("Usage: HazakuraNextLayoutProbe --measure\n".utf8))
            exit(2)
        }
        guard let report = LayoutProbeCommand.measure(using: TextKitViewportTrial.measure),
              let line = try? report.jsonLine() else {
            FileHandle.standardError.write(Data("非表示のTextKit 2計測を完了できませんでした。\n".utf8))
            exit(EXIT_FAILURE)
        }
        print(line)
    }
}
