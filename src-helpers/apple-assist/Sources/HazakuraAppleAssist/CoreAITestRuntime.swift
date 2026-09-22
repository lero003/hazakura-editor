import Foundation
#if COREAI_TEST_BACKEND && !FIXTURE_MODE
import CoreAILanguageModels
import FoundationModels
#elseif COREAI_PRODUCT_BACKEND && !FIXTURE_MODE
import CoreAIKit
import FoundationModels
#endif

enum CoreAIRuntime {
    static let requiresMacOS27 = "Core AI models require macOS 27 or later."
    static let requiresAppleSilicon = "Core AI models require Apple Silicon."
    static let adapterNotBuilt = "The Core AI adapter is not included in this build."
    static let resourceMissing = "The selected Core AI model resource is missing."
    static let resourceInvalid = "The selected Core AI model resource is invalid."
    static let modelLoadFailed = "The selected Core AI model failed to load."
    static let generationFailed = "Core AI generation failed."
    static let emptyCandidate = "Core AI returned an empty candidate."

    static func probe(backend: AssistBackend, modelPath: String?) async -> AppleAssistAvailabilityResponse {
        guard #available(macOS 27.0, *) else {
            return unavailable(requiresMacOS27)
        }
        #if arch(arm64)
        #if COREAI_TEST_BACKEND && !FIXTURE_MODE
        do {
            _ = try await loadTestModel(modelPath: modelPath, backend: backend)
            return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        } catch let failure as CoreAIRuntimeFailure {
            return unavailable(message(for: failure))
        } catch {
            return unavailable(modelLoadFailed)
        }
        #elseif COREAI_PRODUCT_BACKEND && !FIXTURE_MODE
        do {
            _ = try await loadSelectedModel(modelPath: modelPath, backend: backend)
            return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        } catch let failure as CoreAIRuntimeFailure {
            return unavailable(message(for: failure))
        } catch {
            return unavailable(modelLoadFailed)
        }
        #else
        return unavailable(adapterNotBuilt)
        #endif
        #else
        return unavailable(requiresAppleSilicon)
        #endif
    }

    static func unavailableErrorForCurrentHost() -> AppleAssistErrorEnvelope? {
        guard #available(macOS 27.0, *) else {
            return AppleAssistErrorEnvelope(error: requiresMacOS27, kind: "unavailable")
        }
        #if arch(arm64)
        #if COREAI_BACKEND && !FIXTURE_MODE
        return nil
        #else
        return AppleAssistErrorEnvelope(error: adapterNotBuilt, kind: "unavailable")
        #endif
        #else
        return AppleAssistErrorEnvelope(error: requiresAppleSilicon, kind: "unavailable")
        #endif
    }

    private static func unavailable(_ reason: String) -> AppleAssistAvailabilityResponse {
        AppleAssistAvailabilityResponse(kind: "unavailable", reason: reason)
    }

    private static func logModelLoadFailure(_ error: Error) {
        let message = "hazakura-core-ai-helper: model load failed: \(String(reflecting: error))\n"
        FileHandle.standardError.write(Data(message.utf8))
    }

    #if (COREAI_TEST_BACKEND || COREAI_PRODUCT_BACKEND) && !FIXTURE_MODE
    enum CoreAIRuntimeFailure: Error {
        case resourceMissing
        case resourceInvalid
        case modelLoadFailed
    }

    static func loadError(_ error: Error) -> AppleAssistErrorEnvelope {
        let message: String
        if let failure = error as? CoreAIRuntimeFailure {
            message = self.message(for: failure)
        } else {
            message = modelLoadFailed
        }
        return AppleAssistErrorEnvelope(error: message, kind: "unavailable")
    }

    @available(macOS 27.0, *)
    static func generationError(_ error: Error) -> AppleAssistErrorEnvelope {
        if let generationError = error as? LanguageModelSession.GenerationError {
            switch generationError {
            case .exceededContextWindowSize(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI input is too large for this request. Try a smaller selection.",
                    kind: "context_exceeded"
                )
            case .assetsUnavailable(_):
                return AppleAssistErrorEnvelope(error: modelLoadFailed, kind: "unavailable")
            case .guardrailViolation(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI refused this request because it hit a guardrail.",
                    kind: "guardrail"
                )
            case .unsupportedGuide(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI does not support this generation guide.",
                    kind: "unsupported_capability"
                )
            case .unsupportedLanguageOrLocale(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI does not support this language or locale for generation.",
                    kind: "unsupported_capability"
                )
            case .decodingFailure(_):
                return AppleAssistErrorEnvelope(error: generationFailed, kind: "internal")
            case .rateLimited(_), .concurrentRequests(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI is busy with another request. Try again shortly.",
                    kind: "throttled"
                )
            case .refusal(_, _):
                return AppleAssistErrorEnvelope(
                    error: "Core AI refused this request.",
                    kind: "refusal"
                )
            @unknown default:
                break
            }
        }
        return AppleAssistErrorEnvelope(error: generationFailed, kind: "internal")
    }

    private static func message(for failure: CoreAIRuntimeFailure) -> String {
        switch failure {
        case .resourceMissing:
            return resourceMissing
        case .resourceInvalid:
            return resourceInvalid
        case .modelLoadFailed:
            return modelLoadFailed
        }
    }
    #endif

    #if COREAI_TEST_BACKEND && !FIXTURE_MODE
    @available(macOS 27.0, *)
    static func loadTestModel(modelPath: String?, backend: AssistBackend) async throws -> CoreAILanguageModel {
        guard case .coreAITest = backend else { throw CoreAIRuntimeFailure.resourceInvalid }
        let resourceState = CoreAITestResourceContract.validate(path: modelPath)
        let resourceURL: URL
        switch resourceState {
        case .ready(let url):
            resourceURL = url
        case .missing:
            throw CoreAIRuntimeFailure.resourceMissing
        case .invalid:
            throw CoreAIRuntimeFailure.resourceInvalid
        }

        do {
            let model = try await CoreAILanguageModel(resourcesAt: resourceURL, mode: .eager)
            try await model.load()
            return model
        } catch {
            logModelLoadFailure(error)
            throw CoreAIRuntimeFailure.modelLoadFailed
        }
    }

    #endif

    #if COREAI_PRODUCT_BACKEND && !FIXTURE_MODE
    enum LoadedCoreAIModel: Sendable {
        case gemma4(KitGemmaModel)
        case language(KitLanguageModel)
    }

    /// One loaded production model, kept for later requests from the same helper
    /// process. Loading E4B copies 5.4 GB of PLE tables and builds the decode
    /// graph, and the Rust supervisor reuses one helper child across requests, so
    /// reloading per request dominated the time before the first token. Requests
    /// stay serial (the supervisor holds one child), and a session is still
    /// created per request, so this only shares the model and its engine.
    ///
    /// The slot is released when the helper exits (cancel, timeout, app quit),
    /// when a different model or resource signature is requested, and after an
    /// idle period so a 16 GB machine does not hold the weights indefinitely.
    @available(macOS 27.0, *)
    private static let modelCache = CoreAIModelCacheStorage<LoadedCoreAIModel>(
        // Seconds to keep an idle model. Only an explicit `0` keeps it for the
        // helper's lifetime; unset or invalid values use the documented default.
        idleReleaseNanoseconds: CoreAIModelIdlePolicy.idleReleaseNanoseconds(
            from: ProcessInfo.processInfo.environment["HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS"]
        )
    )

    @available(macOS 27.0, *)
    static func loadSelectedModel(
        modelPath: String?,
        backend: AssistBackend
    ) async throws -> LoadedCoreAIModel {
        switch backend {
        case .coreAI:
            return try await loadProductionModel(modelPath: modelPath, backend: backend)
        case .coreAILocal:
            return try await loadLocalModel(modelPath: modelPath, backend: backend)
        case .systemDefault, .coreAITest:
            throw CoreAIRuntimeFailure.resourceInvalid
        }
    }

    @available(macOS 27.0, *)
    private static func loadProductionModel(
        modelPath: String?,
        backend: AssistBackend
    ) async throws -> LoadedCoreAIModel {
        guard case .coreAI(let modelId) = backend else {
            throw CoreAIRuntimeFailure.resourceInvalid
        }
        let state = CoreAIResourceContract.validate(path: modelPath, expectedModelId: modelId)
        let resource: CoreAIProductionResource
        switch state {
        case .ready(let value):
            resource = value
        case .missing:
            throw CoreAIRuntimeFailure.resourceMissing
        case .invalid:
            throw CoreAIRuntimeFailure.resourceInvalid
        }
        let signature = CoreAIResourceContract.signature(for: resource)
        if signature == nil {
            FileHandle.standardError.write(Data(
                "hazakura-core-ai-helper: resource signature unavailable; cached model released and cache disabled for this request\n".utf8
            ))
        }
        return try await loadCachedCoreAIModel(signature: signature, cache: modelCache) {
            try await makeProductionModel(resource: resource, modelId: modelId)
        }
    }

    @available(macOS 27.0, *)
    private static func loadLocalModel(
        modelPath: String?,
        backend: AssistBackend
    ) async throws -> LoadedCoreAIModel {
        guard case .coreAILocal(let registryModelId) = backend else {
            throw CoreAIRuntimeFailure.resourceInvalid
        }
        let resource: CoreAILocalModelResource
        switch CoreAILocalResourceContract.resolve(path: modelPath) {
        case .ready(let value):
            resource = value
        case .error(.rootMissing):
            throw CoreAIRuntimeFailure.resourceMissing
        case .error:
            throw CoreAIRuntimeFailure.resourceInvalid
        }
        let runtimeModelId = resource.modelId ?? registryModelId
        let signature = CoreAILocalResourceContract.signature(for: resource)
        if signature == nil {
            FileHandle.standardError.write(Data(
                "hazakura-core-ai-helper: local resource signature unavailable; cached model released and cache disabled for this request\n".utf8
            ))
        }
        return try await loadCachedCoreAIModel(signature: signature, cache: modelCache) {
            try await makeLocalModel(resource: resource, modelId: runtimeModelId)
        }
    }

    @available(macOS 27.0, *)
    private static func makeProductionModel(
        resource: CoreAIProductionResource,
        modelId: String
    ) async throws -> LoadedCoreAIModel {
        do {
            switch resource.runtimeKind {
            case .gemma4PLE, .gemma4PLEProvider:
                guard let tables = resource.tables else {
                    throw CoreAIRuntimeFailure.resourceInvalid
                }
                return .gemma4(try await KitGemmaModel(
                    decoderBundleAt: resource.bundle,
                    tablesAt: tables,
                    modelID: modelId,
                    pleMode: resource.runtimeKind == .gemma4PLEProvider
                        ? .perTokenProvider : .staticInputs
                ))
            case .language:
                return .language(try await KitLanguageModel(
                    bundleAt: resource.bundle,
                    engineVariant: .pipelined,
                    modelID: modelId
                ))
            }
        } catch let failure as CoreAIRuntimeFailure {
            throw failure
        } catch {
            logModelLoadFailure(error)
            throw CoreAIRuntimeFailure.modelLoadFailed
        }
    }

    @available(macOS 27.0, *)
    private static func makeLocalModel(
        resource: CoreAILocalModelResource,
        modelId: String
    ) async throws -> LoadedCoreAIModel {
        do {
            switch resource.runtimeKind {
            case .gemma4Ple, .gemma4PleProvider:
                guard let tables = resource.tables else {
                    throw CoreAIRuntimeFailure.resourceInvalid
                }
                return .gemma4(try await KitGemmaModel(
                    decoderBundleAt: resource.bundle,
                    tablesAt: tables,
                    modelID: modelId,
                    pleMode: resource.runtimeKind == .gemma4PleProvider
                        ? .perTokenProvider : .staticInputs
                ))
            case .language:
                return .language(try await KitLanguageModel(
                    bundleAt: resource.bundle,
                    engineVariant: .pipelined,
                    modelID: modelId
                ))
            }
        } catch let failure as CoreAIRuntimeFailure {
            throw failure
        } catch {
            logModelLoadFailure(error)
            throw CoreAIRuntimeFailure.modelLoadFailed
        }
    }
    #endif
}
