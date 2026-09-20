import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function decodeCms(profilePath) {
  const security = spawnSync("security", ["cms", "-D", "-i", profilePath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!security.error && security.status === 0 && security.stdout) {
    return security.stdout;
  }

  // `security cms` can fail before decoding in restricted build shells. The
  // profile is a signed CMS envelope, so use the system OpenSSL verifier as a
  // content-only fallback. The signing identity is still checked by codesign.
  const openssl = spawnSync(
    "openssl",
    ["smime", "-verify", "-inform", "DER", "-noverify", "-in", profilePath],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (openssl.error || openssl.status !== 0 || !openssl.stdout) {
    throw new Error("Unable to decode the provisioning profile CMS envelope.");
  }
  return openssl.stdout;
}

export function readProvisioningProfile(profilePath) {
  const decoded = decodeCms(profilePath);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "hazakura-profile-"));
  const plistPath = join(temporaryRoot, "profile.plist");
  writeFileSync(plistPath, decoded, "utf8");

  function extract(keyPath, format = "raw", optional = false) {
    const result = spawnSync(
      "/usr/bin/plutil",
      ["-extract", keyPath, format, "-o", "-", plistPath],
      { encoding: "utf8" },
    );
    if (result.error || result.status !== 0) {
      if (optional) return undefined;
      throw new Error(`Provisioning profile is missing required field ${keyPath}.`);
    }
    const value = result.stdout.trim();
    return format === "json" ? JSON.parse(value) : value;
  }

  try {
    return {
      Name: extract("Name"),
      UUID: extract("UUID"),
      Platform: extract("Platform", "json"),
      ExpirationDate: extract("ExpirationDate"),
      Entitlements: {
        "application-identifier":
          extract("Entitlements.application-identifier", "raw", true) ??
          extract("Entitlements.com\\.apple\\.application-identifier"),
        "com.apple.developer.team-identifier": extract(
          "Entitlements.com\\.apple\\.developer\\.team-identifier",
        ),
        "com.apple.security.application-groups": extract(
          "Entitlements.com\\.apple\\.security\\.application-groups",
          "json",
          true,
        ) ?? [],
        "get-task-allow": extract("Entitlements.get-task-allow", "raw", true) === "true",
      },
    };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function validateProvisioningProfileMetadata(
  profile,
  expectedBundleId,
  expectedAppGroup,
  now = new Date(),
) {
  const platforms = Array.isArray(profile?.Platform) ? profile.Platform : [];
  if (!platforms.includes("OSX")) {
    throw new Error(
      `Provisioning profile for ${expectedBundleId} must include OSX; found ` +
        `${platforms.join(", ") || "no platform"}.`,
    );
  }

  const entitlements = profile?.Entitlements ?? {};
  const teamId = entitlements["com.apple.developer.team-identifier"];
  const applicationIdentifier =
    entitlements["application-identifier"] ??
    entitlements["com.apple.application-identifier"];
  if (typeof teamId !== "string" || applicationIdentifier !== `${teamId}.${expectedBundleId}`) {
    throw new Error(
      `Provisioning profile application identifier does not match ${expectedBundleId}.`,
    );
  }

  const appGroups = entitlements["com.apple.security.application-groups"];
  if (!Array.isArray(appGroups) || !appGroups.includes(expectedAppGroup)) {
    throw new Error(
      `Provisioning profile for ${expectedBundleId} does not include App Group ${expectedAppGroup}.`,
    );
  }
  if (entitlements["get-task-allow"] === true) {
    throw new Error(`Provisioning profile for ${expectedBundleId} permits debugging.`);
  }

  const expiration = new Date(profile?.ExpirationDate);
  if (Number.isNaN(expiration.getTime()) || expiration <= now) {
    throw new Error(`Provisioning profile for ${expectedBundleId} is expired or has no valid expiry.`);
  }

  return {
    name: String(profile?.Name ?? "(unnamed)"),
    uuid: String(profile?.UUID ?? "(missing)"),
    teamId,
    bundleId: expectedBundleId,
    appGroup: expectedAppGroup,
    expiresAt: expiration.toISOString(),
    platforms,
  };
}

export function readAndValidateProvisioningProfile(
  profilePath,
  expectedBundleId,
  expectedAppGroup,
) {
  return validateProvisioningProfileMetadata(
    readProvisioningProfile(profilePath),
    expectedBundleId,
    expectedAppGroup,
  );
}
