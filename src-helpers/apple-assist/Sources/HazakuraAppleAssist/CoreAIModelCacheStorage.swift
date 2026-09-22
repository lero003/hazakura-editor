import Foundation

/// Holds one loaded Core AI model and drops stale entries before a replacement
/// factory starts. The generic storage keeps cache-lifetime tests independent of
/// the Core AI frameworks and their heavyweight model types.
actor CoreAIModelCacheStorage<Model: Sendable> {
    private var entry: (signature: String, model: Model)?
    private var idleTracker = CoreAIModelIdleTracker()
    private let idleReleaseNanoseconds: UInt64?

    init(idleReleaseNanoseconds: UInt64?) {
        self.idleReleaseNanoseconds = idleReleaseNanoseconds
    }

    /// Returns a reusable model. A missing or changed signature invalidates the
    /// current entry synchronously, before the caller starts a fresh load.
    func model(forSignature signature: String?) -> Model? {
        guard let signature else {
            entry = nil
            return nil
        }
        guard let entry else { return nil }
        guard entry.signature == signature else {
            self.entry = nil
            return nil
        }
        scheduleIdleRelease()
        return entry.model
    }

    func store(_ model: Model, forSignature signature: String) {
        entry = (signature, model)
        scheduleIdleRelease()
    }

    /// Called by the idle timer with the token it scheduled. A later access has
    /// already moved `generation` past it, so the release is skipped.
    func releaseIfIdle(token: Int) {
        guard idleTracker.isCurrent(token) else { return }
        entry = nil
    }

    private func scheduleIdleRelease() {
        guard let idleReleaseNanoseconds else { return }
        let token = idleTracker.schedule()
        Task.detached { [weak self] in
            try? await Task.sleep(nanoseconds: idleReleaseNanoseconds)
            await self?.releaseIfIdle(token: token)
        }
    }
}

/// Reuses an exact-signature cache hit. Every miss first completes cache
/// invalidation, then invokes the potentially heavyweight model factory.
func loadCachedCoreAIModel<Model: Sendable>(
    signature: String?,
    cache: CoreAIModelCacheStorage<Model>,
    makeModel: () async throws -> Model
) async rethrows -> Model {
    if let cached = await cache.model(forSignature: signature) {
        return cached
    }

    let model = try await makeModel()
    if let signature {
        await cache.store(model, forSignature: signature)
    }
    return model
}
