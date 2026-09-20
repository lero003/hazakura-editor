import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { readAndValidateProvisioningProfile } from "./apple-provisioning-profile.mjs";

const appGroup = "group.dev.hazakura.editor";
const profiles = [
  {
    bundleId: "dev.hazakura.editor",
    path: resolve(
      process.env.HAZAKURA_APP_STORE_MAIN_PROFILE ||
        "src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile",
    ),
  },
  {
    bundleId: "dev.hazakura.editor.background-downloader",
    path: resolve(
      process.env.HAZAKURA_BACKGROUND_DOWNLOADER_PROFILE ||
        "src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile",
    ),
  },
];

try {
  for (const profile of profiles) {
    if (!existsSync(profile.path)) {
      throw new Error(`Required App Store profile is missing: ${profile.path}`);
    }
    const metadata = readAndValidateProvisioningProfile(
      profile.path,
      profile.bundleId,
      appGroup,
    );
    console.log(
      `Validated ${profile.bundleId}: ${basename(profile.path)} ` +
      `(OSX, expires ${metadata.expiresAt})`,
    );
  }
  if (!process.env.APPLE_SIGNING_IDENTITY || process.env.APPLE_SIGNING_IDENTITY === "-") {
    throw new Error("APPLE_SIGNING_IDENTITY is required for an App Store submit build.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
