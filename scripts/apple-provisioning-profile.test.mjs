import assert from "node:assert/strict";
import { test } from "node:test";
import {
  profileScopedEntitlements,
  validateProvisioningProfileMetadata,
  validateSignedProfileEntitlements,
} from "./apple-provisioning-profile.mjs";

function profile(overrides = {}) {
  return {
    Name: "Hazakura Editor Mac App Store",
    UUID: "00000000-0000-0000-0000-000000000000",
    Platform: ["OSX"],
    ExpirationDate: "2030-01-01T00:00:00Z",
    Entitlements: {
      "application-identifier": "8BNUB2R9C8.dev.hazakura.editor",
      "com.apple.developer.team-identifier": "8BNUB2R9C8",
      "com.apple.security.application-groups": ["group.dev.hazakura.editor"],
      "get-task-allow": false,
    },
    ...overrides,
  };
}

test("accepts an unexpired OSX distribution profile with the exact app identity", () => {
  const metadata = validateProvisioningProfileMetadata(
    profile(),
    "dev.hazakura.editor",
    "group.dev.hazakura.editor",
    new Date("2029-01-01T00:00:00Z"),
  );
  assert.equal(metadata.bundleId, "dev.hazakura.editor");
  assert.equal(metadata.teamId, "8BNUB2R9C8");
});

test("rejects a mobile profile even when its bundle ID and App Group match", () => {
  assert.throws(
    () => validateProvisioningProfileMetadata(
      profile({ Platform: ["iOS", "xrOS", "visionOS"] }),
      "dev.hazakura.editor",
      "group.dev.hazakura.editor",
    ),
    /must include OSX/,
  );
});

test("rejects mismatched identifiers, missing App Groups, and expired profiles", () => {
  assert.throws(
    () => validateProvisioningProfileMetadata(
      profile(),
      "dev.hazakura.editor.background-downloader",
      "group.dev.hazakura.editor",
    ),
    /application identifier/,
  );
  assert.throws(
    () => validateProvisioningProfileMetadata(
      profile({
        Entitlements: {
          ...profile().Entitlements,
          "com.apple.security.application-groups": [],
        },
      }),
      "dev.hazakura.editor",
      "group.dev.hazakura.editor",
    ),
    /App Group/,
  );
  assert.throws(
    () => validateProvisioningProfileMetadata(
      profile({ ExpirationDate: "2028-01-01T00:00:00Z" }),
      "dev.hazakura.editor",
      "group.dev.hazakura.editor",
      new Date("2029-01-01T00:00:00Z"),
    ),
    /expired/,
  );
});

const extensionMetadata = {
  teamId: "8BNUB2R9C8",
  bundleId: "dev.hazakura.editor.background-downloader",
};

test("scopes signed entitlements to the embedded profile application identifier", () => {
  const scoped = profileScopedEntitlements(
    {
      "com.apple.security.app-sandbox": true,
      "com.apple.security.application-groups": ["group.dev.hazakura.editor"],
    },
    extensionMetadata,
  );
  assert.equal(
    scoped["com.apple.application-identifier"],
    "8BNUB2R9C8.dev.hazakura.editor.background-downloader",
  );
  assert.equal(scoped["com.apple.developer.team-identifier"], "8BNUB2R9C8");
  assert.deepEqual(scoped["com.apple.security.application-groups"], [
    "group.dev.hazakura.editor",
  ]);
});

test("TestFlight eligibility check requires the signed application identifier", () => {
  const withoutIdentifier = [
    "[Dict]",
    "\t[Key] com.apple.security.app-sandbox",
    "\t[Value]",
    "\t\t[Bool] true",
  ].join("\n");
  assert.throws(
    () => validateSignedProfileEntitlements(withoutIdentifier, extensionMetadata),
    /application identifier/,
  );

  const wrongTeam = [
    "[Dict]",
    "\t[Key] com.apple.application-identifier",
    "\t[Value]",
    "\t\t[String] AAAAAAAAAA.dev.hazakura.editor.background-downloader",
    "\t[Key] com.apple.developer.team-identifier",
    "\t[Value]",
    "\t\t[String] AAAAAAAAAA",
  ].join("\n");
  assert.throws(
    () => validateSignedProfileEntitlements(wrongTeam, extensionMetadata),
    /application identifier/,
  );

  const signed = [
    "[Dict]",
    "\t[Key] com.apple.application-identifier",
    "\t[Value]",
    "\t\t[String] 8BNUB2R9C8.dev.hazakura.editor.background-downloader",
    "\t[Key] com.apple.developer.team-identifier",
    "\t[Value]",
    "\t\t[String] 8BNUB2R9C8",
  ].join("\n");
  assert.equal(validateSignedProfileEntitlements(signed, extensionMetadata), true);
});
