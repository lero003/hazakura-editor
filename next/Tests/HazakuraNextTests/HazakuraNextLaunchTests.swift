import AppKit
@testable import HazakuraNext
import Testing

struct HazakuraNextLaunchTests {
    @Test func separatesThePreviewBundleFromArgumentSelectedLaunches() {
        typealias Mode = HazakuraNextApp.LaunchMode
        let previewID = "dev.hazakura.editor.next.sandbox-preview.dev"
        let devID = "dev.hazakura.editor.next.dev"
        let demoID = "dev.hazakura.editor.next.assist-demo.dev"
        #expect(Mode.resolve(bundleID: previewID, arguments: []) == .sandboxPreview)
        #expect(Mode.resolve(bundleID: previewID, arguments: ["--long-sample", "--assist-review-demo"]) == .sandboxPreview)
        #expect(Mode.resolve(bundleID: demoID, arguments: []) == .assistDemo)
        #expect(Mode.resolve(bundleID: devID, arguments: []) == .development(longSample: false))
        #expect(Mode.resolve(bundleID: devID, arguments: ["--sandbox-preview"]) == .rejectPreviewArgument)
        #expect(Mode.resolve(bundleID: nil, arguments: ["--build-sandbox-preview"]) == .rejectPreviewArgument)
        #expect(Mode.resolve(bundleID: devID, arguments: ["--long-sample"]) == .development(longSample: true))
        #expect(Mode.resolve(bundleID: nil, arguments: ["--assist-review-demo"]) == .rejectAssistArgument)
    }

    @MainActor
    @Test func sandboxPreviewUsesAnUnsavedSessionWithNoRecoveryStore() throws {
        let delegate = HazakuraNextApp.makeSandboxPreviewDelegate()
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        #expect(window.title == "Hazakura Editor Next — 権限検証用")
        #expect(window.isVisible == false)
        #expect(session.recovery == nil)
        #expect(session.recoveryUnavailable)
        session.requestRecovery()
        #expect(!session.showsRecovery)
        #expect(session.canAddTab)
        #expect(session.canSaveCopy)
    }
}
