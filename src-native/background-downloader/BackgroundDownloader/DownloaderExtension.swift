import BackgroundAssets
import ExtensionFoundation
import StoreKit

@main
struct DownloaderExtension: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool {
        // The production catalog currently publishes only the explicit,
        // on-demand E4B pack. Returning true lets AssetPackManager honor the
        // user's request; it does not make the pack essential at install time.
        true
    }
}
