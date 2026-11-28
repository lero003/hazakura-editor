import Foundation

@main
struct HazakuraNextModelProbe {
    @MainActor static func main() async {
        let arguments = Array(ProcessInfo.processInfo.arguments.dropFirst())
        let mode = AssistModelProbeCommand.parse(arguments)
        let line: String
        let exitCode: Int32
        do {
            switch mode {
            case .invalid:
                FileHandle.standardError.write(Data("Usage: HazakuraNextModelProbe --check | --generate | --compare\n".utf8))
                exit(2)
            case .check, .generate:
                let report = await AssistModelProbeCommand.run(generate: mode == .generate)
                line = try report.jsonLine()
                exitCode = report.exitCode
            case .compare:
                let report = await AssistModelProbeCommand.compare()
                line = try report.jsonLine()
                exitCode = report.exitCode
            }
        } catch {
            FileHandle.standardError.write(Data("計測結果を出力できませんでした。\n".utf8))
            exit(EXIT_FAILURE)
        }
        FileHandle.standardOutput.write(Data(line.utf8))
        exit(exitCode)
    }
}
