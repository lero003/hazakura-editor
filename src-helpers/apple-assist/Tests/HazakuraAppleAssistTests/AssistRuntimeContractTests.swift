import XCTest
@testable import HazakuraAppleAssist

// LA-1: "利用可否 (availability)" と "生成能力 (capability)" を分離する
// 共通契約のテスト。fixture mode では実モデルに触れないため、合成は
// 純関数として直接検査する。live の観測（SystemLanguageModel の読み出し）
// は live ビルドのコンパイルと実機評価で別に確認する。
final class AssistRuntimeContractTests: XCTestCase {
    private let localeIdentifier = "ja_JP"

    private func status(
        _ availability: AssistAvailabilityState,
        localeSupported: Bool? = true
    ) -> AssistRuntimeStatus {
        AssistRuntimeStatus(
            availability: availability,
            capability: localeSupported.map {
                AssistGenerationCapability(localeSupported: $0, localeIdentifier: localeIdentifier)
            }
        )
    }

    // MARK: - probe wire (四態の維持)

    func testProbeWiresAvailableWhenBothSidesAllow() {
        let response = AssistRuntimeContract.probeResponse(status: status(.available))
        XCTAssertEqual(response.kind, "available")
        XCTAssertNil(response.reason)
    }

    func testProbeKeepsLocaleFirstAndReportsItAsUnsupported() {
        // 現行どおり、locale非対応は利用可否に関わらず unsupported + locale文言。
        let blocked = AssistRuntimeContract.probeResponse(
            status: status(.available, localeSupported: false)
        )
        XCTAssertEqual(blocked.kind, "unsupported")
        XCTAssertEqual(blocked.reason, AssistRuntimeMessages.localeUnsupported(localeIdentifier))

        let both = AssistRuntimeContract.probeResponse(
            status: status(.disabled(reason: "Apple Intelligence is not enabled on this Mac."), localeSupported: false)
        )
        XCTAssertEqual(both.kind, "unsupported")
        XCTAssertEqual(both.reason, AssistRuntimeMessages.localeUnsupported(localeIdentifier))
    }

    func testProbeKeepsFrozenFourStateMapping() {
        let disabled = AssistRuntimeContract.probeResponse(status: status(.disabled(reason: "disabled-reason")))
        XCTAssertEqual(disabled.kind, "disabled")
        XCTAssertEqual(disabled.reason, "disabled-reason")

        let unsupported = AssistRuntimeContract.probeResponse(status: status(.unsupported(reason: "unsupported-reason")))
        XCTAssertEqual(unsupported.kind, "unsupported")
        XCTAssertEqual(unsupported.reason, "unsupported-reason")

        let unavailable = AssistRuntimeContract.probeResponse(status: status(.unavailable(reason: "unavailable-reason")))
        XCTAssertEqual(unavailable.kind, "unavailable")
        XCTAssertEqual(unavailable.reason, "unavailable-reason")
    }

    // MARK: - generation gate (能力と利用可否の分離)

    func testGenerationGateClassifiesCapabilityFailureAsUnsupportedLanguage() {
        // 現行の混線 (kind == "unavailable") を分離する。メッセージは不変。
        let error = AssistRuntimeContract.generationError(
            status: status(.available, localeSupported: false)
        )
        XCTAssertEqual(error?.kind, "unsupported_language")
        XCTAssertEqual(error?.error, AssistRuntimeMessages.localeUnsupported(localeIdentifier))
    }

    func testGenerationGateReportsAvailabilityFailuresAsUnavailable() {
        for state in [
            AssistAvailabilityState.disabled(reason: "disabled-reason"),
            .unsupported(reason: "unsupported-reason"),
            .unavailable(reason: "unavailable-reason"),
        ] {
            let error = AssistRuntimeContract.generationError(status: status(state))
            XCTAssertEqual(error?.kind, "unavailable")
        }
        XCTAssertEqual(
            AssistRuntimeContract.generationError(status: status(.disabled(reason: "not enabled")))?.error,
            "not enabled"
        )
    }

    func testGenerationGatePassesOnlyWhenBothSidesAllow() {
        XCTAssertNil(AssistRuntimeContract.generationError(status: status(.available)))
    }

    // MARK: - 不明 (unknown) の扱い

    func testOldOSUnknownCapabilityFallsBackToAvailabilityOnly() {
        // macOS 26未満: 能力は評価不能 (nil) 。locale を読まず、利用可否だけで判定する。
        let osUnsupported = AssistRuntimeStatus.unsupportedOS
        XCTAssertNil(osUnsupported.capability)
        XCTAssertEqual(osUnsupported.availability, .unsupported(reason: "Foundation Models requires macOS 26 or later."))

        let probe = AssistRuntimeContract.probeResponse(status: osUnsupported)
        XCTAssertEqual(probe.kind, "unsupported")
        XCTAssertEqual(probe.reason, "Foundation Models requires macOS 26 or later.")

        let error = AssistRuntimeContract.generationError(status: osUnsupported)
        XCTAssertEqual(error?.kind, "unavailable")
        XCTAssertEqual(error?.error, "Foundation Models requires macOS 26 or later.")
    }

    func testUnknownCapabilityInsideMacOSSixteenIsStillUnknown() {
        // 26上ではあり得ない組み合わせでも、capability nil は locale 判定をスキップする。
        let unknown = AssistRuntimeStatus(availability: .available, capability: nil)
        XCTAssertNil(AssistRuntimeContract.generationError(status: unknown))
        XCTAssertEqual(AssistRuntimeContract.probeResponse(status: unknown).kind, "available")
    }

    // MARK: - 文言の固定 (メッセージで分類する既存消費者を守る)

    func testAvailabilityReasonMessagesStayStable() {
        XCTAssertEqual(AssistRuntimeMessages.requiresMacOS26, "Foundation Models requires macOS 26 or later.")
        XCTAssertEqual(AssistRuntimeMessages.appleIntelligenceNotEnabled, "Apple Intelligence is not enabled on this Mac.")
        XCTAssertEqual(AssistRuntimeMessages.deviceNotEligible, "This Mac is not eligible for Apple Intelligence.")
        XCTAssertEqual(AssistRuntimeMessages.modelNotReady, "The Apple Intelligence model is not ready yet.")
        XCTAssertEqual(AssistRuntimeMessages.unavailableUnknownReason, "Foundation Models is unavailable for an unknown reason.")
    }

    func testLocaleReasonMessageStayStable() {
        XCTAssertEqual(
            AssistRuntimeMessages.localeUnsupported("ja_JP"),
            "Apple Foundation Models does not support the current app language or locale for generation yet: ja_JP"
        )
    }

    // MARK: - fixture probe

    func testFixtureProbeStaysAvailable() {
        XCTAssertEqual(AvailabilityProbe.probe().kind, "available")
        XCTAssertNil(AvailabilityProbe.probe().reason)
    }
}
