import CoreGraphics
import Foundation
import HazakuraNextCore
import WebKit

// Keep WebKit's diagnostics (which may contain URLs) out of user-facing errors.
enum MarkdownPDFExportError: Error, Equatable {
    case documentTooLarge, pdfTooLarge, timedOut, renderingFailed
}

/// A detached, one-shot WebKit capture of the same inert projection used for HTML export.
/// Produces one continuous page, not paginated paper output. The session owns admission/cancellation.
@MainActor
enum MarkdownPDFExport {
    private nonisolated static let pageWidth: Double = 720
    private nonisolated static let maximumHeight: Double = 12_000

    static func render(source: String) async throws -> Data {
        try await render(source: source, didStartCapture: {})
    }

    /// The test callback observes a started navigation before control returns to the run loop.
    static func render(source: String, didStartCapture: @MainActor () -> Void) async throws -> Data {
        let html = try await MarkdownHTMLExport.render(source: source)
        try Task.checkCancellation()
        return try await Capture().run(html: html, didStartCapture: didStartCapture)
    }

    nonisolated static func captureRect(width: Double, height: Double) throws -> CGRect {
        guard width.isFinite, height.isFinite, width > 0, height > 0 else {
            throw MarkdownPDFExportError.renderingFailed
        }
        // Keep a small tail allowance for rounded DOM scrolling metrics. Refuse, don't clamp.
        let paddedHeight = height.rounded(.up) + 2
        guard width <= pageWidth, paddedHeight <= maximumHeight else {
            throw MarkdownPDFExportError.documentTooLarge
        }
        return CGRect(x: 0, y: 0, width: pageWidth, height: paddedHeight)
    }

    nonisolated static func validateByteEnvelope(_ data: Data) throws {
        guard data.count <= SelectedTextCopyWriter.pdfByteLimit else {
            throw MarkdownPDFExportError.pdfTooLarge
        }
        guard data.starts(with: "%PDF-".utf8) else {
            throw MarkdownPDFExportError.renderingFailed
        }
    }

    @MainActor
    private final class Capture: NSObject, WKNavigationDelegate {
        private let clock = ContinuousClock()
        private var view: WKWebView?
        private var navigation: WKNavigation?
        private var allowedInitialLoad = false
        private var completion: CheckedContinuation<Data, any Error>?
        private var deadline: ContinuousClock.Instant?
        private var watchdog: Task<Void, Never>?

        func run(html: String, didStartCapture: @MainActor () -> Void) async throws -> Data {
            try await withTaskCancellationHandler {
                do {
                    let data = try await withCheckedThrowingContinuation { continuation in
                        completion = continuation
                        if Task.isCancelled {
                            finish(.failure(CancellationError()))
                        } else {
                            start(html: html)
                            if navigation != nil { didStartCapture() }
                        }
                    }
                    try Task.checkCancellation()
                    return data
                } catch {
                    try Task.checkCancellation()
                    throw error
                }
            } onCancel: {
                Task { @MainActor in self.finish(.failure(CancellationError())) }
            }
        }

        private func start(html: String) {
            let deadline = clock.now.advanced(by: .seconds(8))
            self.deadline = deadline
            // Do not race WebKit's async overlay in a task group: that call need not
            // cooperate with cancellation, and a group would still wait for it to exit.
            watchdog = Task { [weak self, clock] in
                do { try await clock.sleep(until: deadline) } catch { return }
                self?.finish(.failure(MarkdownPDFExportError.timedOut))
            }

            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .nonPersistent()
            configuration.defaultWebpagePreferences.allowsContentJavaScript = false
            let view = WKWebView(frame: CGRect(x: 0, y: 0, width: pageWidth, height: 160),
                                 configuration: configuration)
            self.view = view
            view.navigationDelegate = self
            // No UI delegate, window, user scripts, message handlers or URL loaders.
            // The caller is private and passes exactly the generated HTML with a fixed CSP.
            navigation = view.loadHTMLString(html, baseURL: nil)
            if navigation == nil { finish(.failure(MarkdownPDFExportError.renderingFailed)) }
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard canAdvance(), !allowedInitialLoad, action.targetFrame?.isMainFrame == true,
                  action.navigationType == .other, action.request.url?.absoluteString == "about:blank" else {
                return .cancel
            }
            allowedInitialLoad = true
            return .allow
        }

        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
            guard canAdvance(), allowedInitialLoad, response.isForMainFrame, response.canShowMIMEType,
                  response.response.url?.absoluteString == "about:blank" else { return .cancel }
            return .allow
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard canAdvance(), let navigation, navigation === self.navigation,
                  webView.url?.absoluteString == "about:blank" else { return }
            self.navigation = nil
            // macOS WKWebView has no public preflight contentSize API. This bounded DOM
            // read uses fixed code in an isolated client world, never author JavaScript.
            // Outside list markers can protrude left without expanding root.scrollWidth.
            webView.evaluateJavaScript("""
                (() => {
                    const root = document.documentElement;
                    const range = document.createRange();
                    range.selectNodeContents(document.body);
                    const content = range.getBoundingClientRect();
                    const wideMarker = Array.from(document.querySelectorAll('li[value]'))
                        .some(item => item.value < -99 || item.value > 999);
                    return [Math.max(root.scrollWidth, content.right),
                            Math.max(root.scrollHeight, content.bottom), content.left, Number(wideMarker)];
                })()
                """, in: nil, in: .defaultClient, completionHandler: { [weak self] result in
                    self?.capture(measurement: result)
                })
        }

        private func capture(measurement: Result<Any, any Error>) {
            guard canAdvance(), let view else { return }
            guard case let .success(value) = measurement, let metrics = value as? [Double],
                  metrics.count == 4, metrics[2].isFinite, metrics[3].isFinite else {
                finish(.failure(MarkdownPDFExportError.renderingFailed))
                return
            }
            guard metrics[2] >= 0, metrics[3] == 0 else {
                finish(.failure(MarkdownPDFExportError.documentTooLarge))
                return
            }
            let rect: CGRect
            do { rect = try captureRect(width: metrics[0], height: metrics[1]) } catch {
                finish(.failure(error))
                return
            }
            let configuration = WKPDFConfiguration()
            configuration.rect = rect
            view.createPDF(configuration: configuration) { [weak self] result in
                self?.receivePDF(result, rect: rect)
            }
        }

        private func receivePDF(_ result: Result<Data, any Error>, rect: CGRect) {
            guard canAdvance() else { return }
            guard case let .success(data) = result else {
                finish(.failure(MarkdownPDFExportError.renderingFailed))
                return
            }
            do {
                try validateByteEnvelope(data)
                guard let provider = CGDataProvider(data: data as CFData), let pdf = CGPDFDocument(provider),
                      pdf.numberOfPages == 1, pdf.page(at: 1)?.getBoxRect(.mediaBox) == rect else {
                    throw MarkdownPDFExportError.renderingFailed
                }
                if canAdvance() { finish(.success(data)) }
            } catch {
                finish(.failure(error))
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            if let navigation, navigation === self.navigation { finish(.failure(MarkdownPDFExportError.renderingFailed)) }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
            if let navigation, navigation === self.navigation { finish(.failure(MarkdownPDFExportError.renderingFailed)) }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            finish(.failure(MarkdownPDFExportError.renderingFailed))
        }

        private func canAdvance() -> Bool {
            guard completion != nil, let deadline else { return false }
            guard clock.now < deadline else {
                finish(.failure(MarkdownPDFExportError.timedOut))
                return false
            }
            return true
        }

        private func finish(_ result: Result<Data, any Error>) {
            guard let completion else { return }
            self.completion = nil
            watchdog?.cancel()
            watchdog = nil
            navigation = nil
            // stopLoading cancels navigation; capture has no native cancellation API.
            // Release the private view and ignore late callbacks on all exit paths.
            view?.stopLoading()
            view = nil
            completion.resume(with: result)
        }
    }
}
