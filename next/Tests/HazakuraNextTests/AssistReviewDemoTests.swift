@testable import HazakuraNext
import Testing

@MainActor
struct AssistReviewDemoTests {
    @Test func defaultInitializationCreatesOnlyAFreshInMemoryFixture() throws {
        let first = AssistReviewDemoDelegate()
        let second = AssistReviewDemoDelegate()
        let tab = try #require(first.session.tabs.selectedTab)
        #expect(first.session.tabs.tabs.count == 1)
        #expect(tab.document.id != second.session.tabs.selectedID)
        #expect(tab.document.revision == 0)
        #expect(tab.document.source.utf8.elementsEqual(AssistReviewDemoDelegate.source.utf8))
        #expect(tab.isReadOnly == false)
        #expect(tab.selectedFile == nil)
        #expect(tab.copyOrigin == nil)
        #expect(first.session.window == nil)
        #expect(first.session.recovery == nil)
        #expect(first.session.recoveryUnavailable == false)
        #expect(first.session.isBusy == false)
    }
}
