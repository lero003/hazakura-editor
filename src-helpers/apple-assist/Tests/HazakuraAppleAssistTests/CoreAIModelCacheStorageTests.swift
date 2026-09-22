import Testing
@testable import HazakuraAppleAssist

private final class CachedResource: Sendable {}

private enum FactoryFailure: Error {
    case expected
}

struct CoreAIModelCacheStorageTests {
    @Test
    func sameSignatureReusesTheCachedModelWithoutCallingTheFactory() async {
        let cache = CoreAIModelCacheStorage<CachedResource>(idleReleaseNanoseconds: nil)
        var factoryCalls = 0

        let first = await loadCachedCoreAIModel(signature: "same", cache: cache) {
            factoryCalls += 1
            return CachedResource()
        }
        let second = await loadCachedCoreAIModel(signature: "same", cache: cache) {
            factoryCalls += 1
            return CachedResource()
        }

        #expect(first === second)
        #expect(factoryCalls == 1)
    }

    @Test
    func signatureMismatchReleasesTheOldModelBeforeCallingTheFactory() async {
        let cache = CoreAIModelCacheStorage<CachedResource>(idleReleaseNanoseconds: nil)
        var oldModel: CachedResource? = await loadCachedCoreAIModel(
            signature: "old",
            cache: cache
        ) {
            CachedResource()
        }
        weak let releasedModel = oldModel
        oldModel = nil
        #expect(releasedModel != nil)

        _ = await loadCachedCoreAIModel(signature: "new", cache: cache) {
            #expect(releasedModel == nil)
            return CachedResource()
        }

        #expect(releasedModel == nil)
    }

    @Test
    func failedReloadDoesNotRetainTheOldModel() async {
        let cache = CoreAIModelCacheStorage<CachedResource>(idleReleaseNanoseconds: nil)
        var oldModel: CachedResource? = await loadCachedCoreAIModel(
            signature: "old",
            cache: cache
        ) {
            CachedResource()
        }
        weak let releasedModel = oldModel
        oldModel = nil

        do {
            _ = try await loadCachedCoreAIModel(signature: "new", cache: cache) {
                #expect(releasedModel == nil)
                throw FactoryFailure.expected
            }
            Issue.record("The replacement factory should have failed")
        } catch FactoryFailure.expected {
            // Expected.
        } catch {
            Issue.record("Unexpected replacement error: \(error)")
        }

        #expect(releasedModel == nil)
    }

    @Test
    func unavailableSignatureReleasesTheOldModelBeforeFreshLoad() async {
        let cache = CoreAIModelCacheStorage<CachedResource>(idleReleaseNanoseconds: nil)
        var oldModel: CachedResource? = await loadCachedCoreAIModel(
            signature: "known",
            cache: cache
        ) {
            CachedResource()
        }
        weak let releasedModel = oldModel
        oldModel = nil

        _ = await loadCachedCoreAIModel(signature: nil, cache: cache) {
            #expect(releasedModel == nil)
            return CachedResource()
        }

        #expect(releasedModel == nil)
    }
}
