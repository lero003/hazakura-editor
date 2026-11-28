import Foundation
import Security

// Reads the generated bundles and their signatures; does not open or re-sign them.
struct DevelopmentBundle {
    let name: String
    let id: String
    let entitlementKeys: Set<String>

    func verify(in products: URL) throws {
        let url = products.appending(path: name + ".app", directoryHint: .isDirectory)
        guard let bundle = Bundle(url: url), bundle.bundleIdentifier == id else {
            throw Failure(reason: "\(name): missing bundle or unexpected Info.plist identifier")
        }
        // SwiftPM builds one local architecture; the signed metadata below is slice-specific.
        guard bundle.executableArchitectures?.count == 1 else {
            throw Failure(reason: "\(name): expected a single-architecture development executable")
        }
        var code: SecStaticCode?
        let create = SecStaticCodeCreateWithPath(url as CFURL, [], &code)
        guard create == errSecSuccess, let code else {
            throw Failure(reason: "\(name): cannot read code signature (\(create))")
        }
        let validation = SecStaticCodeCheckValidity(code, SecCSFlags(rawValue: kSecCSStrictValidate), nil)
        guard validation == errSecSuccess else {
            throw Failure(reason: "\(name): invalid code signature (\(validation))")
        }
        var information: CFDictionary?
        let read = SecCodeCopySigningInformation(code, SecCSFlags(rawValue: kSecCSSigningInformation), &information)
        guard read == errSecSuccess, let info = information as? [String: Any],
              let flags = info[kSecCodeInfoFlags as String] as? NSNumber,
              SecCodeSignatureFlags(rawValue: flags.uint32Value).contains(.adhoc),
              info[kSecCodeInfoIdentifier as String] as? String == id else {
            throw Failure(reason: "\(name): expected the matching ad-hoc signature")
        }

        guard let signedPlist = info[kSecCodeInfoPList as String] as? [String: Any],
              signedPlist["CFBundleIdentifier"] as? String == id,
              signedPlist["CFBundleExecutable"] as? String == "HazakuraNext" else {
            throw Failure(reason: "\(name): unexpected secured Info.plist")
        }

        let entitlements: [String: Any]
        if let field = info[kSecCodeInfoEntitlementsDict as String] {
            guard let dictionary = field as? [String: Any] else {
                throw Failure(reason: "\(name): invalid signed entitlement dictionary")
            }
            entitlements = dictionary
        } else {
            // Security also omits the dictionary when it cannot interpret an embedded blob.
            guard info[kSecCodeInfoEntitlements as String] == nil else {
                throw Failure(reason: "\(name): unrecognized signed entitlement format")
            }
            entitlements = [:]
        }
        guard Set(entitlements.keys) == entitlementKeys, entitlements.values.allSatisfy({ value in
            guard let boolean = value as? NSNumber, CFGetTypeID(boolean) == CFBooleanGetTypeID() else { return false }
            return boolean.boolValue
        }) else {
            throw Failure(reason: "\(name): unexpected signed entitlements")
        }

        // These development bundles contain a single executable, not a distribution payload.
        let contents = url.appending(path: "Contents", directoryHint: .isDirectory)
        let files = FileManager.default
        let bundleNames = try files.contentsOfDirectory(atPath: url.path)
        let contentsNames = try files.contentsOfDirectory(atPath: contents.path)
        let executableNames = try files.contentsOfDirectory(atPath: contents.appending(path: "MacOS").path)
        guard bundleNames == ["Contents"], Set(contentsNames) == ["Info.plist", "MacOS", "_CodeSignature"],
              executableNames == ["HazakuraNext"], bundle.executableURL?.lastPathComponent == "HazakuraNext" else {
            throw Failure(reason: "\(name): unexpected development bundle contents")
        }
        print("Verified \(id)")
    }
}

struct Failure: Error {
    let reason: String
}

func stop(_ message: String, status: Int32) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(status)
}

guard CommandLine.arguments.count == 2, !CommandLine.arguments[1].isEmpty else {
    stop("Usage: swift next/scripts/verify-dev-bundles.swift <SwiftPM bin path>", status: 2)
}
let products = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let expected = [
    DevelopmentBundle(name: "Hazakura Editor Next", id: "dev.hazakura.editor.next.dev", entitlementKeys: []),
    DevelopmentBundle(name: "Hazakura Editor Next Assist Demo", id: "dev.hazakura.editor.next.assist-demo.dev", entitlementKeys: []),
    DevelopmentBundle(name: "Hazakura Editor Next Sandbox Preview", id: "dev.hazakura.editor.next.sandbox-preview.dev",
                      entitlementKeys: ["com.apple.security.app-sandbox", "com.apple.security.files.user-selected.read-write"]),
]
do {
    for bundle in expected { try bundle.verify(in: products) }
} catch let failure as Failure {
    stop(failure.reason, status: 1)
} catch {
    stop("Cannot inspect the development bundle contents.", status: 1)
}
