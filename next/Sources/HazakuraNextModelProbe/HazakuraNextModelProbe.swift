import Foundation

@main
struct HazakuraNextModelProbe {
    @MainActor static func main() async {
        let arguments = Array(ProcessInfo.processInfo.arguments.dropFirst())
        let mode = AssistModelProbeCommand.parse(arguments)
        guard mode != .invalid else {
            FileHandle.standardError.write(Data("Usage: HazakuraNextModelProbe --check | --generate\n".utf8))
            exit(2)
        }
        let report = await AssistModelProbeCommand.run(generate: mode == .generate)
        do {
            FileHandle.standardOutput.write(Data(try report.jsonLine().utf8))
        } catch {
            FileHandle.standardError.write(Data("計測結果を出力できませんでした。\n".utf8))
            exit(EXIT_FAILURE)
        }
        exit(report.exitCode)
    }
}
